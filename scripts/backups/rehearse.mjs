import {randomUUID} from "node:crypto";
import {spawn} from "node:child_process";
import {readFile,writeFile,mkdtemp,rm,realpath,chmod} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve,sep} from "node:path";
import {pathToFileURL} from "node:url";
import {PROJECT,POSTGRES_IMAGE} from "./policy.mjs";
import {fileDigests} from "./drive.mjs";
function localDockerEndpoint(value){
 return typeof value==="string" && (/^unix:\/\/\/[^?#\r\n]+$/.test(value) || /^npipe:\/{4}\.\/pipe\/[^?#\r\n]+$/i.test(value));
}
export function validateRehearsalEnvironment(env){
 if(env.DOCKER_HOST && env.DOCKER_CONTEXT)throw new Error("Conflicting Docker host/context settings are not accepted for restoration.");
 if(env.DOCKER_HOST && !localDockerEndpoint(env.DOCKER_HOST))throw new Error("A local Docker daemon is required for private isolated restoration.");
 if(env.CI||["BACKUP_DATABASE_URL","DATABASE_URL","PGHOST","PGPASSWORD","PGSERVICE","SUPABASE_SECRET_KEY","RESEND_API_KEY","RESEND_NEWSLETTER_API_KEY"].some(key=>env[key]))throw new Error("Run the restore rehearsal locally with production connection and outbound-service credentials absent.");
}
function command(executable,args,{capture=false,environment=process.env}={}){
 return new Promise((accept,reject)=>{
  const child=spawn(executable,args,{env:Object.fromEntries(["PATH","SystemRoot","HOME","USERPROFILE","DOCKER_HOST","DOCKER_CONTEXT"].filter(key=>environment[key]).map(key=>[key,environment[key]])),stdio:["ignore",capture?"pipe":"ignore","ignore"]});
  let output="";if(capture)child.stdout.on("data",chunk=>{output+=chunk.toString();if(output.length>65536)child.kill();});
  child.once("error",()=>reject(new Error("Restore tool unavailable.")));child.once("exit",code=>code===0?accept(output):reject(new Error("Isolated restore operation failed; no production target was used.")));
 });
}
export function tolerateExistingRoles(sql){
 return sql.replace(/^CREATE ROLE ((?:"(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*));$/gm,(_line,role)=>`DO $$ BEGIN CREATE ROLE ${role}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
}
export async function rehearse({database,roles,receipt,identity},env=process.env){
 validateRehearsalEnvironment(env);
 const endpoint=env.DOCKER_HOST??JSON.parse(await command("docker",["context","inspect","--format","{{json .Endpoints.docker.Host}}"],{capture:true,environment:env}));
 if(!localDockerEndpoint(endpoint))throw new Error("Remote Docker contexts are not accepted for restoration.");
 const pinnedEnvironment={...env,DOCKER_HOST:endpoint};delete pinnedEnvironment.DOCKER_CONTEXT;
 const run=(executable,args,options={})=>command(executable,args,{...options,environment:pinnedEnvironment});
 if(!database||!roles||!receipt||!identity)throw new Error("Supply database/roles ciphertext, completion receipt and a local identity file.");
 const evidence=JSON.parse(await readFile(receipt,"utf8"));
 if(evidence.format!=="jnuits-db-backup/v1"||evidence.project!==PROJECT||evidence.postgresClientImage!==POSTGRES_IMAGE)throw new Error("Unsupported or mismatched backup receipt.");
 for(const [type,path] of [["database",database],["roles",roles]]){
  const expected=evidence.objects?.find(item=>item.type===type),actual=await fileDigests(path);
  if(!expected||expected.sha256!==actual.sha256||expected.bytes!==actual.size)throw new Error("Ciphertext checksum mismatch.");
 }
 const started=performance.now(),container="jnuits-restore-"+randomUUID(),temporary=await mkdtemp(join(tmpdir(),"jnuits-restore-rehearsal-"));
 let created=false;
 try{
  const dumpPath=join(temporary,"database.dump"),rolePath=join(temporary,"roles.sql");
  await run("age",["--decrypt","--identity",resolve(identity),"--output",dumpPath,resolve(database)]);
  await run("age",["--decrypt","--identity",resolve(identity),"--output",rolePath,resolve(roles)]);
  await chmod(dumpPath,0o600);await chmod(rolePath,0o600);
  await writeFile(rolePath,tolerateExistingRoles(await readFile(rolePath,"utf8")),{mode:0o600});
  await run("docker",["run","--detach","--name",container,"--label","jnuits.restore-isolated=true","--network","none","--env","POSTGRES_PASSWORD=isolated-restore-only",POSTGRES_IMAGE,"postgres","-D","/etc/postgresql","-c","cron.launch_active_jobs=off"]);
  created=true;
  let ready=false;
  for(let attempt=0;attempt<120;attempt++){
   try{await run("docker",["exec",container,"pg_isready","-U","supabase_admin"]);if(!["postgres",".postgres-wrapp"].includes((await run("docker",["exec",container,"cat","/proc/1/comm"],{capture:true})).trim()))throw new Error("Initialization still running.");ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,500));}
  }
  if(!ready)throw new Error("Isolated PostgreSQL did not become ready.");
  const security=JSON.parse(await run("docker",["inspect",container],{capture:true}))[0];
  if(security.HostConfig.NetworkMode!=="none"||Object.keys(security.HostConfig.PortBindings??{}).length)throw new Error("Restore isolation could not be verified.");
  await run("docker",["cp",rolePath,container+":/tmp/rehearsal-roles.sql"]);
  await run("docker",["cp",dumpPath,container+":/tmp/rehearsal.dump"]);
  await run("docker",["exec",container,"psql","-U","supabase_admin","-d","postgres","-v","ON_ERROR_STOP=1","-f","/tmp/rehearsal-roles.sql"]);
  await run("docker",["exec",container,"psql","-U","supabase_admin","-d","postgres","-v","ON_ERROR_STOP=1","-c","CREATE DATABASE jnuits_restore TEMPLATE template0"]);
  await run("docker",["exec",container,"pg_restore","-U","supabase_admin","--dbname=jnuits_restore","--exit-on-error","--single-transaction","/tmp/rehearsal.dump"]);
  const verification=await run("docker",["exec",container,"psql","-U","supabase_admin","-d","jnuits_restore","-At","-v","ON_ERROR_STOP=1","-c","select jsonb_build_object('public_tables',(select count(*) from pg_tables where schemaname='public'),'auth_users',(select count(*) from auth.users),'storage_metadata',(select count(*) from storage.objects),'migration_receipts',(select count(*) from supabase_migrations.schema_migrations),'public_rls_disabled',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity));"],{capture:true});
  const checks=JSON.parse(verification);
  if(checks.public_rls_disabled!==0||checks.public_tables<1||checks.migration_receipts<1)throw new Error("Restored database verification failed.");
  const seconds=Math.round((performance.now()-started)/1000);
  const result={backupId:evidence.backupId,rehearsedAt:new Date().toISOString(),seconds,rtoTargetSeconds:14400,rtoMet:seconds<=14400,isolated:true,outboundMail:false,checks,limitations:["Storage-object bytes and provider settings require separate recovery.","Vault/column-encryption root keys must be held and recovered separately by the owner."]};
  console.log(JSON.stringify(result));if(!result.rtoMet)throw new Error("The four-hour recovery objective was exceeded.");return result;
 }finally{
  try{if(created)await run("docker",["rm","--force",container]);}finally{
  const absolute=await realpath(temporary),parent=await realpath(tmpdir());
  if(!absolute.startsWith(parent+sep)||!absolute.slice(parent.length+1).startsWith("jnuits-restore-rehearsal-"))throw new Error("Refusing cleanup outside rehearsal scratch.");
  await rm(absolute,{recursive:true,force:true});
  }
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),options={};for(let index=0;index<args.length;index+=2){if(!["--database","--roles","--receipt","--identity"].includes(args[index]))throw new Error("Unsupported rehearsal argument.");options[args[index].slice(2)]=args[index+1];}
 rehearse(options).catch(()=>{console.error("Isolated restore rehearsal failed. Record this as an unverified recovery point and inspect it locally; production connections were not accepted.");process.exitCode=1;});
}

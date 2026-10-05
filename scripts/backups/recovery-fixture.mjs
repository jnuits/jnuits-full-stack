import {randomUUID} from "node:crypto";
import {spawn} from "node:child_process";
import {mkdtemp,writeFile,rm,realpath} from "node:fs/promises";
import {tmpdir} from "node:os";import {join,sep} from "node:path";
import {POSTGRES_IMAGE,PROJECT} from "./policy.mjs";
import {encryptProducer} from "./run.mjs";import {fileDigests} from "./drive.mjs";
import {rehearse,validateRehearsalEnvironment} from "./rehearse.mjs";
function command(bin,args,capture=false){
 return new Promise((resolve,reject)=>{const child=spawn(bin,args,{stdio:["ignore",capture?"pipe":"ignore","ignore"]});let out="";if(capture)child.stdout.on("data",chunk=>out+=chunk.toString());child.once("error",reject);child.once("exit",code=>code===0?resolve(out.trim()):reject(new Error("Disposable fixture operation failed.")));});
}
validateRehearsalEnvironment(process.env);
const temporary=await mkdtemp(join(tmpdir(),"jnuits-backup-fixture-")),source="jnuits-backup-fixture-"+randomUUID();let created=false;
try{
 const identity=join(temporary,"fixture-key");await command("age-keygen",["--output",identity]);
 const recipient=await command("age-keygen",["-y",identity],true);
 await command("docker",["run","--detach","--name",source,"--label","jnuits.backup-fixture=true","--network","none","--env","POSTGRES_PASSWORD=disposable-fixture-only",POSTGRES_IMAGE,"postgres","-D","/etc/postgresql","-c","cron.launch_active_jobs=off"]);created=true;
 let ready=false;for(let i=0;i<120;i++){try{await command("docker",["exec",source,"pg_isready","-U","supabase_admin"]);if(!["postgres",".postgres-wrapp"].includes(await command("docker",["exec",source,"cat","/proc/1/comm"],true)))throw new Error("Initialization still running.");ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,500));}}
 if(!ready)throw new Error("Disposable database not ready.");
 const seed=join(temporary,"seed.sql");await writeFile(seed,`create schema if not exists auth;create schema if not exists storage;create schema if not exists supabase_migrations;
 create table if not exists auth.users(id uuid primary key,email text);
 create table if not exists storage.objects(id uuid primary key,name text);
 create table if not exists supabase_migrations.schema_migrations(version text primary key);
 create table public.backup_fixture(id integer primary key,label text);alter table public.backup_fixture enable row level security;
 insert into public.backup_fixture values(1,'disposable proof');insert into auth.users(id,email) values('11111111-1111-4111-8111-111111111111','fictional@example.test');
 insert into supabase_migrations.schema_migrations(version) values('fixture');`);
 await command("docker",["cp",seed,source+":/tmp/fixture-seed.sql"]);await command("docker",["exec",source,"psql","-U","supabase_admin","-d","postgres","-v","ON_ERROR_STOP=1","-f","/tmp/fixture-seed.sql"]);
 const objects=[],paths={};
 for(const type of ["database","roles"]){
  const destination=join(temporary,type+".age");paths[type]=destination;
  await encryptProducer({command:"docker",args:["exec",source,type==="roles"?"pg_dumpall":"pg_dump","-U","supabase_admin",...(type==="roles"?["--roles-only","--no-role-passwords"]:["--format=custom","--dbname=postgres"])],recipient,destination,onDiagnostic:message=>console.error("Disposable fixture dump diagnostic:",message)});
  const digest=await fileDigests(destination);objects.push({type,sha256:digest.sha256,bytes:digest.size});
 }
 const receipt=join(temporary,"receipt.json");await writeFile(receipt,JSON.stringify({format:"jnuits-db-backup/v1",project:PROJECT,backupId:randomUUID(),postgresClientImage:POSTGRES_IMAGE,objects}));
 const result=await rehearse({database:paths.database,roles:paths.roles,receipt,identity});
 if(result.checks.auth_users!==1||result.checks.migration_receipts!==1)throw new Error("Fixture restore lost database contents.");
 console.log("DISPOSABLE ENCRYPTION / RESTORE FIXTURE PASSED");
}finally{
 try{if(created)await command("docker",["rm","--force",source]);}finally{
 const absolute=await realpath(temporary),parent=await realpath(tmpdir());
 if(!absolute.startsWith(parent+sep)||!absolute.slice(parent.length+1).startsWith("jnuits-backup-fixture-"))throw new Error("Invalid fixture cleanup target.");
 await rm(absolute,{recursive:true,force:true});
 }
}

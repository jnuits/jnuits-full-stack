import {randomUUID} from "node:crypto";
import {spawn} from "node:child_process";
import {mkdtemp,writeFile,rm,realpath} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve,sep} from "node:path";
import {pipeline} from "node:stream/promises";
import {pathToFileURL} from "node:url";
import {PROJECT,POSTGRES_IMAGE,parseBackupConnection} from "./policy.mjs";
import {createBackupDrive} from "./drive.mjs";
import {driveAuthentication,backupDriveToken} from "./authentication.mjs";
const required=["BACKUP_DATABASE_URL","BACKUP_DB_SSL_ROOT_CERT","BACKUP_AGE_RECIPIENT","BACKUP_DRIVE_FOLDER_ID","BACKUP_DRIVE_ALLOWED_PERMISSION_IDS"];
export function backupConfiguration(env){
 for(const name of required)if(!env[name]?.trim())throw new Error("Missing backup setting: "+name);
 if(!/^age1[a-z0-9]{58}$/.test(env.BACKUP_AGE_RECIPIENT))throw new Error("A public age encryption recipient is required.");
 if(env.BACKUP_AGE_RECIPIENT.includes("SECRET")||env.AGE_SECRET_KEY||env.BACKUP_AGE_IDENTITY)throw new Error("Private recovery keys must remain outside backup CI.");
 if(env.GOOGLE_DRIVE_EXPORTS_FOLDER_ID===env.BACKUP_DRIVE_FOLDER_ID)throw new Error("The backup folder must be separate from application exports.");
 if(!env.BACKUP_DRIVE_ALLOWED_PERMISSION_IDS.split(",").some(value=>value.trim()))throw new Error("Backup permission allowlist must not be empty.");
 return {authMode:driveAuthentication(env),connection:parseBackupConnection(env.BACKUP_DATABASE_URL),recipient:env.BACKUP_AGE_RECIPIENT,folder:env.BACKUP_DRIVE_FOLDER_ID,allowedPermissions:new Set(env.BACKUP_DRIVE_ALLOWED_PERMISSION_IDS.split(",").map(value=>value.trim()).filter(Boolean))};
}
function minimalEnvironment(){return Object.fromEntries(["PATH","SystemRoot","TEMP","TMP","HOME","USERPROFILE","DOCKER_HOST","DOCKER_CONTEXT"].filter(name=>process.env[name]).map(name=>[name,process.env[name]]));}
function completion(child,label,onDiagnostic){
 let warnings=0;child.stderr?.on("data",chunk=>{warnings+=chunk.length;onDiagnostic?.(chunk.toString());});
 return new Promise((accept,reject)=>{child.once("error",()=>reject(new Error(label+" unavailable.")));child.once("exit",code=>code===0&&warnings===0?accept():reject(new Error(label+" failed; private diagnostics were withheld.")));});
}
export async function encryptedDump({connection,recipient,certificateFile,destination,roles=false}){
 const name="jnuits-backup-"+randomUUID();
 const pgEnv={...connection,PGSSLROOTCERT:"/backup-root.crt",PGOPTIONS:"-c statement_timeout=3600000"};
 const args=["run","--rm","--name",name,"--label","jnuits.backup=ephemeral","--mount",`type=bind,source=${certificateFile},target=/backup-root.crt,readonly`,...Object.keys(pgEnv).flatMap(key=>["--env",key]),"--entrypoint",roles?"pg_dumpall":"pg_dump",POSTGRES_IMAGE,...(roles?["--roles-only","--no-role-passwords"]:["--format=custom","--lock-wait-timeout=30000"]),"--no-password"];
 return encryptProducer({command:"docker",args,env:{...minimalEnvironment(),...pgEnv},recipient,destination,cleanup:async()=>{
  const cleanup=spawn("docker",["rm","--force",name],{env:minimalEnvironment(),stdio:"ignore"});
  await new Promise(resolve=>{cleanup.once("exit",resolve);cleanup.once("error",resolve);});
 }});
}
export async function encryptProducer({command,args,env,recipient,destination,cleanup=async()=>{},onDiagnostic}){
 const dump=spawn(command,args,{env:env??minimalEnvironment(),stdio:["ignore","pipe","pipe"]});
 const age=spawn("age",["--encrypt","--recipient",recipient,"--output",destination],{env:minimalEnvironment(),stdio:["pipe","ignore","pipe"]});
 const done=[completion(dump,"Database dump",onDiagnostic),completion(age,"Encryption"),pipeline(dump.stdout,age.stdin)];
 try{await Promise.all(done);}catch(error){
  dump.kill();age.kill();await cleanup();await Promise.allSettled(done);throw error;
 }
}
export async function runBackup(env=process.env){
 const config=backupConfiguration(env),startedAt=new Date().toISOString(),backupId=randomUUID();
 const temporary=await mkdtemp(join(tmpdir(),"jnuits-encrypted-backup-"));
 try{
  const rootCertificate=join(temporary,"root.crt");await writeFile(rootCertificate,env.BACKUP_DB_SSL_ROOT_CERT,{mode:0o600});
  const drive=createBackupDrive({token:await backupDriveToken(env),requireSharedDrive:config.authMode==="service_account",folder:config.folder,allowedPermissions:config.allowedPermissions});
  await drive.assertPrivateFolder();
  const objects=[];
  for(const type of ["database","roles"]){
   const path=join(temporary,type+".age");
   await encryptedDump({connection:config.connection,recipient:config.recipient,certificateFile:rootCertificate,destination:path,roles:type==="roles"});
   objects.push(await drive.upload(path,{backupId,type}));
  }
  await drive.assertPrivateFolder();
  const receipt={format:"jnuits-db-backup/v1",project:PROJECT,backupId,startedAt,completedAt:new Date().toISOString(),gitRevision:env.GITHUB_SHA??null,postgresClientImage:POSTGRES_IMAGE,objects,coverage:{database:"all non-system schemas, data, large objects, RLS and ACLs",roles:"role definitions without passwords",migrationHistory:true,storageObjectBytes:false,providerSettings:false,encryptionRootKey:false}};
  const receiptPath=join(temporary,"receipt.json");await writeFile(receiptPath,JSON.stringify(receipt,null,2),{mode:0o600});
  await drive.upload(receiptPath,{backupId,type:"receipt"});
  const retired=await drive.prune();
  console.log(JSON.stringify({status:"completed",project:PROJECT,backupId,completedAt:receipt.completedAt,ciphertextChecksums:objects.map(({type,sha256,bytes})=>({type,sha256,bytes})),retiredFiles:retired}));
  return receipt;
 }finally{
  const absolute=await realpath(temporary),parent=await realpath(tmpdir());
  if(!absolute.startsWith(parent+sep)||!absolute.slice(parent.length+1).startsWith("jnuits-encrypted-backup-"))throw new Error("Refusing cleanup outside the backup scratch directory.");
  await rm(absolute,{recursive:true,force:true});
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 runBackup().catch(()=>{console.error("Encrypted database backup failed. Verify the private completion receipt before claiming a recovery point; inspect private configuration and operator diagnostics.");process.exitCode=1;});
}

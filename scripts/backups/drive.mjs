import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import {open} from "node:fs/promises";
import {assertPrivatePermissions,backupName,MANAGED_BY,PROJECT,managedRetentionCandidates} from "./policy.mjs";
const API="https://www.googleapis.com/drive/v3";
export async function fileDigests(path){
 const sha=createHash("sha256"),md5=createHash("md5");let size=0;
 for await(const chunk of createReadStream(path)){sha.update(chunk);md5.update(chunk);size+=chunk.length;}
 return {sha256:sha.digest("hex"),md5:md5.digest("hex"),size};
}
export function createBackupDrive({token,folder,allowedPermissions,requireSharedDrive=false,fetchImpl=fetch,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 if(!/^[A-Za-z0-9_-]+$/.test(folder))throw new Error("Invalid backup folder.");
 async function request(url,init={}){
  if(new URL(url).origin!=="https://www.googleapis.com")throw new Error("Untrusted Drive upload location.");
  const response=await fetchImpl(url,{...init,redirect:"error",signal:AbortSignal.timeout(120000),headers:{Authorization:"Bearer "+token,...init.headers}});
  return response;
 }
 async function json(url){
  const response=await request(url);if(!response.ok)throw new Error("Drive inspection unavailable.");return response.json();
 }
 async function pages(path,field){
  const items=[];let pageToken;const seen=new Set();
  do{
   const url=new URL(API+path);if(pageToken)url.searchParams.set("pageToken",pageToken);
   const data=await json(url.toString());if(!Array.isArray(data[field]))throw new Error("Drive list unavailable.");
   items.push(...data[field]);pageToken=data.nextPageToken;if(pageToken&&seen.has(pageToken))throw new Error("Repeated Drive page token.");seen.add(pageToken);
  }while(pageToken);
  return items;
 }
 async function assertPrivateFolder(){
  const pending=[folder],seen=new Set();
  while(pending.length){
   const id=pending.pop();if(seen.has(id))continue;seen.add(id);if(seen.size>32)throw new Error("Unverifiable folder ancestry.");
   const info=await json(API+"/files/"+encodeURIComponent(id)+"?supportsAllDrives=true&fields=id,mimeType,parents,trashed,driveId");
   if(info.trashed||info.mimeType!=="application/vnd.google-apps.folder")throw new Error("Backup target is not a private folder.");
   if(id===folder && requireSharedDrive && !info.driveId)throw new Error("Service-account backups require a private Shared Drive folder.");
   const permissions=await pages("/files/"+encodeURIComponent(id)+"/permissions?supportsAllDrives=true&pageSize=100&fields=nextPageToken,permissions(id,type,deleted)","permissions");
   assertPrivatePermissions(permissions,allowedPermissions);pending.push(...(info.parents??[]));
  }
 }
 async function upload(path,{backupId,type}){
  const digest=await fileDigests(path);if(digest.size===0)throw new Error("Empty backup.");
  const file=await open(path,"r");
  try{
   if(type!=="receipt"){
    const marker=Buffer.alloc(22);await file.read(marker,0,marker.length,0);
    if(!marker.toString("ascii").startsWith("age-encryption.org/v1\n"))throw new Error("Only age-encrypted database artifacts may be uploaded.");
   }
   const metadata={name:backupName(backupId,type),parents:[folder],appProperties:{managedBy:MANAGED_BY,project:PROJECT,backupId,type,complete:type==="receipt"?"true":"false",sha256:digest.sha256}};
   const start=await request("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",{method:"POST",headers:{"Content-Type":"application/json","X-Upload-Content-Type":"application/octet-stream","X-Upload-Content-Length":String(digest.size)},body:JSON.stringify(metadata)});
   const location=start.headers.get("location");if(!start.ok||!location||new URL(location).origin!=="https://www.googleapis.com")throw new Error("Untrusted or unavailable Drive upload location.");
   let offset=0,finished,failures=0;
   while(offset<digest.size){
    const size=Math.min(8*1024*1024,digest.size-offset),buffer=Buffer.alloc(size);
    const {bytesRead}=await file.read(buffer,0,size,offset);if(bytesRead!==size)throw new Error("Backup file changed during upload.");
    let response;
    try{response=await request(location,{method:"PUT",headers:{"Content-Type":"application/octet-stream","Content-Range":`bytes ${offset}-${offset+size-1}/${digest.size}`},body:buffer});}
    catch{response=null;}
    if(!response||response.status===429||response.status>=500){
     if(++failures>5)throw new Error("Drive upload retry limit exceeded.");
     await sleep(Math.min(30000,1000*2**failures));
     response=await request(location,{method:"PUT",headers:{"Content-Range":"bytes */"+digest.size,"Content-Length":"0"}});
    }
    if(response.status===308){
     const range=response.headers.get("range");const next=range?Number(range.match(/^bytes=0-(\d+)$/)?.[1])+1:0;
     if(!Number.isSafeInteger(next)||next<0||next>digest.size||next<offset)throw new Error("Invalid resumable upload acknowledgment.");
     if(next===offset && ++failures>5)throw new Error("Drive upload made no progress.");
     if(next>offset)failures=0;
     offset=next;
    }else if(response.ok){finished=await response.json();offset=digest.size;}
    else throw new Error("Drive upload unavailable.");
   }
   if(!finished?.id)throw new Error("Drive upload did not complete.");
   const remote=await json(API+"/files/"+encodeURIComponent(finished.id)+"?supportsAllDrives=true&fields=id,size,md5Checksum,parents,appProperties");
   if(Number(remote.size)!==digest.size||remote.md5Checksum!==digest.md5||!remote.parents?.includes(folder)||remote.appProperties?.sha256!==digest.sha256||remote.appProperties?.backupId!==backupId)throw new Error("Encrypted backup integrity verification failed.");
   return {id:remote.id,sha256:digest.sha256,bytes:digest.size,type};
  }finally{await file.close();}
 }
 async function prune(){
  await assertPrivateFolder();
  const query="'"+folder+"' in parents and trashed = false";
  const files=await pages("/files?q="+encodeURIComponent(query)+"&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1000&fields=nextPageToken,files(id,name,parents,createdTime,trashed,size,appProperties)","files");
  const ids=managedRetentionCandidates(files,folder);
  for(const id of ids){const response=await request(API+"/files/"+encodeURIComponent(id)+"?supportsAllDrives=true",{method:"DELETE"});if(!response.ok)throw new Error("Managed backup retention failed.");}
  return ids.length;
 }
 return {assertPrivateFolder,upload,prune};
}

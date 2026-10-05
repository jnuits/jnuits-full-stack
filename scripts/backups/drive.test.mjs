import {afterEach,describe,expect,it,vi} from "vitest";
import {mkdtemp,rm,writeFile} from "node:fs/promises";import {tmpdir} from "node:os";import {join} from "node:path";import {createHash} from "node:crypto";
import {createBackupDrive} from "./drive.mjs";
const directories=[];afterEach(async()=>{for(const dir of directories.splice(0))await rm(dir,{recursive:true,force:true});});
const options=fetchImpl=>({token:"fixture-token",folder:"private-folder",allowedPermissions:new Set(["owner"]),fetchImpl,sleep:async()=>{}});
describe("encrypted backup Drive transport",()=>{
 it("resumes a multi-chunk upload after a lost acknowledgment",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"jnuits-backup-test-"));directories.push(dir);
  const path=join(dir,"fixture.age"),bytes=Buffer.alloc(8*1024*1024+128*1024,42);
  Buffer.from("age-encryption.org/v1\n").copy(bytes);await writeFile(path,bytes);
  let metadata,attempts=0,probes=0;const bodies=[];
  const fetch=vi.fn(async(url,init)=>{
   if(init.method==="POST"){metadata=JSON.parse(init.body);return new Response("",{headers:{location:"https://www.googleapis.com/upload/drive/v3/files?upload_id=fixture"}});}
   if(init.method==="PUT"){
    if(init.headers["Content-Length"]==="0"){ if(++probes===1)return new Response(null,{status:503});return new Response(null,{status:308,headers:{range:"bytes=0-8388607"}}); }
    bodies.push(Buffer.from(init.body));
    if(++attempts===1)return new Response(null,{status:503});
    return Response.json({id:"file-fixture"});
   }
   return Response.json({id:"file-fixture",size:String(bytes.length),md5Checksum:createHash("md5").update(bytes).digest("hex"),parents:["private-folder"],appProperties:metadata.appProperties});
  });
  const file=await createBackupDrive(options(fetch)).upload(path,{backupId:"11111111-1111-4111-8111-111111111111",type:"database"});
  expect(file.bytes).toBe(bytes.length);expect(probes).toBe(2);
  expect(bodies.map(body=>body.length)).toEqual([8*1024*1024,128*1024]);
  expect(Buffer.concat(bodies).equals(bytes)).toBe(true);
 });

 it("caps repeated zero-progress upload acknowledgments",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"jnuits-backup-test-"));directories.push(dir);
  const path=join(dir,"fixture.age");await writeFile(path,"age-encryption.org/v1\nfixture ciphertext");
  let puts=0;
  const fetch=vi.fn(async(url,init)=>{
   if(init.method==="POST")return new Response("",{headers:{location:"https://www.googleapis.com/upload/drive/v3/files?upload_id=fixture"}});
   if(++puts>8)throw new Error("Fixture stopped an unbounded loop.");
   return new Response(null,{status:308});
  });
  await expect(createBackupDrive(options(fetch)).upload(path,{backupId:"11111111-1111-4111-8111-111111111111",type:"database"})).rejects.toThrow("Drive upload made no progress.");
  expect(puts).toBe(6);
 });

 it("refuses a My Drive target in service-account mode before any upload",async()=>{
  const fetch=vi.fn(async url=>String(url).includes("/permissions")?Response.json({permissions:[{id:"owner",type:"user"}]}):Response.json({id:"private-folder",mimeType:"application/vnd.google-apps.folder",parents:[]}));
  await expect(createBackupDrive({...options(fetch),requireSharedDrive:true}).assertPrivateFolder()).rejects.toThrow(/shared drive/i);
  expect(fetch).toHaveBeenCalledOnce();
 });
 it("rejects an exposed ancestor before upload",async()=>{
  const fetch=vi.fn(async url=>String(url).includes("/permissions")?Response.json({permissions:[{id:"owner",type:"anyone"}]}):Response.json({id:"private-folder",mimeType:"application/vnd.google-apps.folder",parents:[]}));
  await expect(createBackupDrive(options(fetch)).assertPrivateFolder()).rejects.toThrow();expect(fetch.mock.calls.every(([,init])=>init?.method!=="POST")).toBe(true);
 });
 it("denies a resumable URL outside Google without forwarding the bearer token",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"jnuits-backup-test-"));directories.push(dir);const path=join(dir,"fixture.age");await writeFile(path,"age-encryption.org/v1\nfixture ciphertext");
  const fetch=vi.fn(async()=>new Response("",{status:200,headers:{location:"https://attacker.example/upload"}}));
  await expect(createBackupDrive(options(fetch)).upload(path,{backupId:"11111111-1111-4111-8111-111111111111",type:"database"})).rejects.toThrow();expect(fetch).toHaveBeenCalledOnce();
 });
 it("verifies the provider checksum before returning a completed object",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"jnuits-backup-test-"));directories.push(dir);const path=join(dir,"fixture.age");const bytes="age-encryption.org/v1\nfixture ciphertext";await writeFile(path,bytes);
  const fetch=vi.fn().mockResolvedValueOnce(new Response("",{status:200,headers:{location:"https://www.googleapis.com/upload/drive/v3/files?upload_id=fixture"}})).mockResolvedValueOnce(Response.json({id:"file-fixture"})).mockResolvedValueOnce(Response.json({id:"file-fixture",size:String(bytes.length),md5Checksum:"invalid"}));
  await expect(createBackupDrive(options(fetch)).upload(path,{backupId:"11111111-1111-4111-8111-111111111111",type:"database"})).rejects.toThrow(/integrity/i);
 });
 it("uploads bounded chunks and accepts only matching final metadata",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"jnuits-backup-test-"));directories.push(dir);const path=join(dir,"fixture.age");const bytes="age-encryption.org/v1\nfixture ciphertext";await writeFile(path,bytes);
  let metadata;const fetch=vi.fn(async(url,init)=>{
   if(init.method==="POST"){metadata=JSON.parse(init.body);return new Response("",{headers:{location:"https://www.googleapis.com/upload/drive/v3/files?upload_id=fixture"}});}
   if(init.method==="PUT")return Response.json({id:"file-fixture"});
   return Response.json({id:"file-fixture",size:String(bytes.length),md5Checksum:createHash("md5").update(bytes).digest("hex"),parents:["private-folder"],appProperties:metadata.appProperties});
  });
  const file=await createBackupDrive(options(fetch)).upload(path,{backupId:"11111111-1111-4111-8111-111111111111",type:"database"});
  expect(file.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));expect(metadata.name).toMatch(/\.dump\.age$/);expect(fetch.mock.calls[1][1].headers["Content-Range"]).toBe(`bytes 0-${bytes.length-1}/${bytes.length}`);
 });
});
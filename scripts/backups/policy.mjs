export const PROJECT = "fsirdkjgrcocowxqjhjg";
export const MANAGED_BY = "jnuits-db-backup/v1";
export const POSTGRES_IMAGE = "public.ecr.aws/supabase/postgres:17.6.1.167@sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export const suffixes={database:"dump.age",roles:"roles.sql.age",receipt:"receipt.json"};
export function backupName(backupId,type){if(!uuid.test(backupId)||!suffixes[type])throw new Error("Invalid backup identity.");return `jnuits-${PROJECT}-${backupId}.${suffixes[type]}`;}
export function parseBackupConnection(value){
  let url;try{url=new URL(value);}catch{throw new Error("Invalid backup connection.");}
  const direct=url.hostname===`db.${PROJECT}.supabase.co`;
  const session=url.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(url.username).endsWith("."+PROJECT);
  if(!["postgres:","postgresql:"].includes(url.protocol)||(!direct&&!session)||(url.port&&url.port!=="5432")||url.pathname!=="/postgres"||!url.password||url.search||url.hash)throw new Error("Backup connection must target the designated project's direct/session PostgreSQL endpoint.");
  return {PGHOST:url.hostname,PGPORT:"5432",PGDATABASE:"postgres",PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:"verify-full",PGCONNECT_TIMEOUT:"20",PGAPPNAME:"jnuits-encrypted-backup"};
}
export function assertPrivatePermissions(permissions,allowed){
  if(!Array.isArray(permissions)||permissions.length===0)throw new Error("Private folder permissions could not be verified.");
  for(const permission of permissions){if(!["user","group"].includes(permission.type)||!allowed.has(permission.id)||permission.deleted)throw new Error("Backup folder has public or unapproved access.");}
}
export function managedRetentionCandidates(files,folder,now=new Date()){
  const groups=new Map();
  for(const file of files){
    const p=file.appProperties ?? {};
    if(p.managedBy!==MANAGED_BY||p.project!==PROJECT||!uuid.test(p.backupId??"")||!suffixes[p.type]||file.name!==backupName(p.backupId,p.type)||file.trashed||!file.parents?.includes(folder)||!/^[a-f0-9]{64}$/.test(p.sha256??"")||!Number.isFinite(Date.parse(file.createdTime))||Number(file.size)<=0)continue;
    if(!groups.has(p.backupId))groups.set(p.backupId,[]);groups.get(p.backupId).push(file);
  }
  const completed=[...groups.values()].filter(group=>group.length===3&&new Set(group.map(file=>file.appProperties.type)).size===3&&group.find(file=>file.appProperties.type==="receipt")?.appProperties.complete==="true");
  completed.sort((a,b)=>Date.parse(b.find(file=>file.appProperties.type==="receipt").createdTime)-Date.parse(a.find(file=>file.appProperties.type==="receipt").createdTime));
  const cutoff=now.getTime()-30*86400000;
  // Always retain the newest complete recovery point even during a long outage.
  return completed.slice(1).filter(group=>group.every(file=>Date.parse(file.createdTime)<cutoff)).flatMap(group=>group.map(file=>file.id));
}

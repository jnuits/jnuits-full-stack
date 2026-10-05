import { describe, expect, it } from "vitest";
import { assertPrivatePermissions, managedRetentionCandidates, parseBackupConnection } from "./policy.mjs";
const folder="private-folder";
const file=(type,id,days=31)=>({id,name:`jnuits-fsirdkjgrcocowxqjhjg-11111111-1111-4111-8111-111111111111.${type==="database"?"dump.age":type==="roles"?"roles.sql.age":"receipt.json"}`,parents:[folder],createdTime:new Date(Date.UTC(2026,9,4)-days*86400000).toISOString(),trashed:false,size:"100",appProperties:{managedBy:"jnuits-db-backup/v1",project:"fsirdkjgrcocowxqjhjg",backupId:"11111111-1111-4111-8111-111111111111",type,complete:type==="receipt"?"true":"false",sha256:"a".repeat(64)}});
describe("backup boundaries",()=>{
  it("accepts only the designated direct/session connection and enforces verified TLS",()=>{
    const value=parseBackupConnection("postgresql://postgres.fsirdkjgrcocowxqjhjg:fixture@aws-0-ap-south-1.pooler.supabase.com:5432/postgres");
    expect(value.PGPORT).toBe("5432");expect(value.PGSSLMODE).toBe("verify-full");
    for(const url of ["postgresql://postgres:fixture@attacker.test:5432/postgres","postgresql://postgres.other:fixture@aws-0-ap-south-1.pooler.supabase.com:5432/postgres","postgresql://postgres.fsirdkjgrcocowxqjhjg:fixture@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"]){expect(()=>parseBackupConnection(url)).toThrow();}
  });
  it("rejects public/domain access and every non-allowlisted permission",()=>{
    expect(()=>assertPrivatePermissions([{id:"owner",type:"user"},{id:"service",type:"user"}],new Set(["owner","service"]))).not.toThrow();
    for(const permissions of [[{id:"owner",type:"anyone"}],[{id:"owner",type:"domain"}],[{id:"unapproved",type:"user"}],[]]){expect(()=>assertPrivatePermissions(permissions,new Set(["owner"]))).toThrow();}
  });
  it("retains unmarked, other-folder, malformed, partial and current backups",()=>{
    const db=file("database","db"),roles=file("roles","roles"),receipt=file("receipt","receipt");
    const current=[file("database","current-db",1),file("roles","current-roles",1),file("receipt","current-receipt",1)].map(value=>({...value,name:value.name.replace("11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222"),appProperties:{...value.appProperties,backupId:"22222222-2222-4222-8222-222222222222"}}));
    const unsafe=[{...file("database","foreign"),appProperties:{}},{...file("database","elsewhere"),parents:["public-export"]},{...file("database","wrong-project"),appProperties:{...db.appProperties,project:"other"}},{...file("database","invalid-name"),name:"important.txt"}];
    expect(managedRetentionCandidates([db,roles,receipt,...current,...unsafe],folder,new Date("2026-10-04T00:00:00Z"))).toEqual(["db","roles","receipt"]);
    expect(managedRetentionCandidates([db,roles],folder,new Date("2026-10-04T00:00:00Z"))).toEqual([]);
    expect(managedRetentionCandidates([db,roles,receipt],folder,new Date("2026-10-04T00:00:00Z"))).toEqual([]);
  });
});

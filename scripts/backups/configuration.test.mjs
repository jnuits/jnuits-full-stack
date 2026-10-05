import { describe,expect,it } from "vitest";
import {backupConfiguration} from "./run.mjs";
import {validateRehearsalEnvironment,tolerateExistingRoles} from "./rehearse.mjs";
const fixture={BACKUP_DATABASE_URL:"postgresql://postgres:fixture@db.fsirdkjgrcocowxqjhjg.supabase.co:5432/postgres",BACKUP_DB_SSL_ROOT_CERT:"-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----",BACKUP_AGE_RECIPIENT:"age1"+"a".repeat(58),BACKUP_DRIVE_FOLDER_ID:"private-folder",BACKUP_DRIVE_ALLOWED_PERMISSION_IDS:"owner,service",BACKUP_DRIVE_SERVICE_ACCOUNT_EMAIL:"fixture@example.test",BACKUP_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY:"fixture-not-a-real-key"};
describe("backup and restore operator configuration",()=>{
 it("refuses incomplete configuration, application-export reuse and private recovery keys",()=>{
  expect(()=>backupConfiguration(fixture)).not.toThrow();
  expect(backupConfiguration({...fixture,BACKUP_DRIVE_AUTH_MODE:"oauth",BACKUP_DRIVE_SERVICE_ACCOUNT_EMAIL:"",BACKUP_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY:"",BACKUP_DRIVE_OAUTH_CLIENT_ID:"fixture-client",BACKUP_DRIVE_OAUTH_CLIENT_SECRET:"fixture-secret",BACKUP_DRIVE_OAUTH_REFRESH_TOKEN:"fixture-refresh"}).authMode).toBe("oauth");
  for(const env of [{...fixture,BACKUP_DATABASE_URL:""},{...fixture,GOOGLE_DRIVE_EXPORTS_FOLDER_ID:"private-folder"},{...fixture,BACKUP_AGE_IDENTITY:"private-recovery-key"},{...fixture,BACKUP_DRIVE_ALLOWED_PERMISSION_IDS:",,,"}])expect(()=>backupConfiguration(env)).toThrow();
 });
 it("refuses CI and inherited production/database/mail connections for isolated restore",()=>{
  expect(()=>validateRehearsalEnvironment({})).not.toThrow();
  expect(()=>validateRehearsalEnvironment({DOCKER_HOST:"ssh://production.example"})).toThrow();
  expect(()=>validateRehearsalEnvironment({DOCKER_HOST:"npipe:////./pipe/docker_engine",DOCKER_CONTEXT:"remote-production"})).toThrow();
  for(const key of ["CI","BACKUP_DATABASE_URL","DATABASE_URL","SUPABASE_SECRET_KEY","RESEND_NEWSLETTER_API_KEY","PGHOST"]){expect(()=>validateRehearsalEnvironment({[key]:"configured"})).toThrow();}
 });
 it("preserves archived role changes and quoted role names while tolerating pre-existing image roles",()=>{
  const sql='CREATE ROLE "quote""role";\nALTER ROLE "quote""role" WITH NOLOGIN;\nCREATE ROLE postgres;';
  const result=tolerateExistingRoles(sql);expect(result).toContain('CREATE ROLE "quote""role"; EXCEPTION WHEN duplicate_object THEN NULL;');expect(result).toContain('ALTER ROLE "quote""role" WITH NOLOGIN;');expect(result).toContain('CREATE ROLE postgres; EXCEPTION');
 });
});

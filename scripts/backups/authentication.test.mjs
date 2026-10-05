import {describe,expect,it,vi} from "vitest";
import {driveAuthentication,backupDriveToken} from "./authentication.mjs";
describe("owner-controlled backup Drive authentication",()=>{
 it("selects only complete explicit authentication modes",()=>{
  expect(driveAuthentication({BACKUP_DRIVE_AUTH_MODE:"oauth",BACKUP_DRIVE_OAUTH_CLIENT_ID:"fixture-client",BACKUP_DRIVE_OAUTH_CLIENT_SECRET:"fixture-secret",BACKUP_DRIVE_OAUTH_REFRESH_TOKEN:"fixture-refresh"})).toBe("oauth");
  expect(()=>driveAuthentication({BACKUP_DRIVE_AUTH_MODE:"oauth"})).toThrow();
  expect(()=>driveAuthentication({BACKUP_DRIVE_AUTH_MODE:"unsupported"})).toThrow();
  expect(()=>driveAuthentication({BACKUP_DRIVE_AUTH_MODE:"service_account",BACKUP_DRIVE_SERVICE_ACCOUNT_EMAIL:"fixture@example.test"})).toThrow();
 });
 it("refreshes dedicated OAuth credentials without exposing provider errors",async()=>{
  const env={BACKUP_DRIVE_AUTH_MODE:"oauth",BACKUP_DRIVE_OAUTH_CLIENT_ID:"fixture-client",BACKUP_DRIVE_OAUTH_CLIENT_SECRET:"fixture-secret",BACKUP_DRIVE_OAUTH_REFRESH_TOKEN:"fixture-refresh"};
  const fetchImpl=vi.fn(async()=>Response.json({access_token:"fixture-access",expires_in:3600}));
  expect(await backupDriveToken(env,fetchImpl)).toBe("fixture-access");
  const [url,init]=fetchImpl.mock.calls[0];
  expect(url).toBe("https://oauth2.googleapis.com/token");
  expect(init.redirect).toBe("error");
  expect(init.body.get("grant_type")).toBe("refresh_token");
  expect(init.body.get("refresh_token")).toBe("fixture-refresh");
  await expect(backupDriveToken(env,async()=>new Response("fixture-sensitive-provider-error",{status:401}))).rejects.toThrow("Backup Drive authentication unavailable.");
  await expect(backupDriveToken(env,async()=>Response.json({access_token:"fixture-access",expires_in:30}))).rejects.toThrow();
 });
});

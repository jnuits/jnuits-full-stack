import {createSign} from "node:crypto";

export function driveAuthentication(env) {
  const mode = env.BACKUP_DRIVE_AUTH_MODE || "service_account";
  const required = mode === "oauth"
    ? ["BACKUP_DRIVE_OAUTH_CLIENT_ID", "BACKUP_DRIVE_OAUTH_CLIENT_SECRET", "BACKUP_DRIVE_OAUTH_REFRESH_TOKEN"]
    : mode === "service_account"
      ? ["BACKUP_DRIVE_SERVICE_ACCOUNT_EMAIL", "BACKUP_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY"]
      : null;
  if (!required) throw new Error("Unsupported backup Drive authentication mode.");
  for (const name of required) {
    if (!env[name]?.trim()) throw new Error("Missing backup setting: " + name);
  }
  return mode;
}

export async function backupDriveToken(env, fetchImpl = fetch) {
  const mode = driveAuthentication(env);
  let body;
  if (mode === "oauth") {
    body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.BACKUP_DRIVE_OAUTH_CLIENT_ID,
      client_secret: env.BACKUP_DRIVE_OAUTH_CLIENT_SECRET,
      refresh_token: env.BACKUP_DRIVE_OAUTH_REFRESH_TOKEN,
    });
  } else {
    const now = Math.floor(Date.now() / 1000);
    const encoded = value => Buffer.from(JSON.stringify(value)).toString("base64url");
    // This JWT authorizes only the dedicated service account; no user subject.
    const unsigned = encoded({alg: "RS256", typ: "JWT"}) + "." + encoded({
      iss: env.BACKUP_DRIVE_SERVICE_ACCOUNT_EMAIL,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    });
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    const assertion = unsigned + "." + signer.sign(
      env.BACKUP_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY.replaceAll("\\n", "\n"),
      "base64url",
    );
    body = new URLSearchParams({grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion});
  }
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body,
  });
  if (!response.ok) throw new Error("Backup Drive authentication unavailable.");
  const data = await response.json();
  // The job is capped at 55 minutes; reject short-lived tokens before dumping.
  if (typeof data.access_token !== "string" || !data.access_token || Number(data.expires_in) < 3300 || !Number.isFinite(Number(data.expires_in))) {
    throw new Error("Backup Drive authentication unavailable.");
  }
  return data.access_token;
}

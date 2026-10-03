import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, sep } from "node:path";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { disableReplayCatalogCache } from "./configure-bootstrap-replay.mjs";

// Only creates its own isolated, unlinked project. There is deliberately no
// --db-url, --linked, existing workdir or hosted-credentials argument.
assert.equal(process.argv.length, 2, "Remote database/workdir arguments are forbidden.");
assert.ok(!process.env.ADMIN_VERIFICATION_QA_WORKDIR && !process.env.SUPABASE_DB_URL, "External projects are forbidden.");
const repo = realpathSync(process.cwd());
const root = join(repo, ".replay-scratch"); mkdirSync(root, { recursive: true });
const scratch = mkdtempSync(join(root, "replay.admin-"));
assert.ok(realpathSync(scratch).startsWith(`${realpathSync(root)}${sep}replay.admin-`));
const runId = randomBytes(6).toString("hex");
const projectId = `jnuits-admin-qa-${runId}`;
const dbContainer = `supabase_db_${projectId}`;
const bridgeToken = randomBytes(32).toString("base64url");
const screenshots = mkdtempSync(join(tmpdir(), "jnuits-admin-qa-"));
const require = createRequire(join(repo, "package.json"));
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");
const accounts = new Map(); const mail = new Map(); const memberIds = []; const requestIds = [];
let next; let bridge; let started = false; let renewalMember;
function cli(args) {
  const result = process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", "npx", "--yes", "supabase@2.109.1", ...args], { cwd: scratch, encoding: "utf8", maxBuffer: 16e6 })
    : spawnSync("npx", ["--yes", "supabase@2.109.1", ...args], { cwd: scratch, encoding: "utf8", maxBuffer: 16e6 });
  if (result.status !== 0) throw new Error(`Disposable CLI ${args[0]} failed; credentials/output withheld.`);
  return result.stdout;
}
function sql(query) {
  assert.ok(dbContainer.startsWith("supabase_db_jnuits-admin-qa-"));
  return execFileSync("docker", ["exec", dbContainer, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", query], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function jsonSql(query) { return JSON.parse(sql(query)); }
function uuid(value) { assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/); return value; }
function totp(secret) {
  let bits = ""; for (const character of secret.toUpperCase().replace(/=+$/, "")) { const index = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(character); assert.ok(index >= 0); bits += index.toString(2).padStart(5, "0"); }
  const key = Buffer.from(bits.match(/.{8}/g).map(byte => Number.parseInt(byte, 2)));
  const count = Buffer.alloc(8); count.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hash = createHmac("sha1", key).update(count).digest(); const offset = hash.at(-1) & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}
try {
  cli(["init"]);
  const configPath = join(scratch, "supabase", "config.toml");
  assert.ok(!existsSync(join(scratch, "supabase", ".temp", "project-ref")), "Linked projects are forbidden.");
  let config = disableReplayCatalogCache(readFileSync(configPath, "utf8"));
  config = config.replace(/^project_id = .*$/m, `project_id = "${projectId}"`);
  // Mechanical config rewrite confined to this newly-created scratch project.
  const ports = { api: 55761, db: 55762, "db.pooler": 55769, studio: 55763, inbucket: 55764 };
  let section = "";
  config = config.split(/\r?\n/).map(line => {
    const match = /^\[([^\]]+)\]/.exec(line); if (match) section = match[1];
    if (Object.hasOwn(ports, section) && /^port =/.test(line)) return `port = ${ports[section]}`;
    if (section === "db" && /^shadow_port =/.test(line)) return "shadow_port = 55760";
    if (section === "auth" && /^site_url =/.test(line)) return 'site_url = "http://127.0.0.1:3127"';
    if (section === "auth.mfa.totp" && /^(enroll_enabled|verify_enabled) =/.test(line)) return line.replace(/= false$/, "= true");
    if (section === "auth.hook.custom_access_token" && /^enabled =/.test(line)) return "enabled = true";
    if (section === "auth.hook.custom_access_token" && /^uri =/.test(line)) return 'uri = "pg-functions://postgres/public/jnuits_custom_access_token_hook"';
    return line;
  }).join("\n");
  if (!/^\[auth.hook.custom_access_token\]/m.test(config)) config += '\n[auth.hook.custom_access_token]\nenabled = true\nuri = "pg-functions://postgres/public/jnuits_custom_access_token_hook"\n';
  writeFileSync(configPath, config);
  const migrations = join(scratch, "supabase", "migrations"); mkdirSync(migrations, { recursive: true });
  copyFileSync(join(repo, "supabase/verification/baseline/20260608092959_restore_rls_auto_enable.sql"), join(migrations, "20260608092959_restore_rls_auto_enable.sql"));
  for (const name of readdirSync(join(repo, "supabase/migrations")).filter(name => name.endsWith(".sql"))) copyFileSync(join(repo, "supabase/migrations", name), join(migrations, name));
  console.log("Starting disposable Auth/Postgres; no hosted credentials are used.");
  started = true;
  cli(["start", "--exclude", "edge-runtime,imgproxy,logflare,postgres-meta,realtime,storage-api,studio,supavisor,vector", "--yes"]);
  const output = cli(["status", "--output", "json"]);
  const status = JSON.parse(output.slice(output.indexOf("{")));
  assert.equal(status.API_URL, "http://127.0.0.1:55761");
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  // Mirror existing hosted explicit exposure. Never grant browser RBAC/proof
  // table writes; authorization RPC ACLs remain exactly as migrated.
  sql("grant select on all tables in schema public to service_role; update public.security_settings set admin_totp_enforced=false where id;");
  for (const [name, role] of [["never", "super_admin"], ["voluntary", "super_admin"], ["super", "super_admin"], ["target", "content_admin"]]) {
    const email = `qa-${name}-${runId}@local.invalid`, password = `Qa!${randomBytes(18).toString("base64url")}`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert.ok(!created.error && created.data.user, "Synthetic account creation failed.");
    const userId = uuid(created.data.user.id);
    const adminCode = `JNUITS-ADMIN-QA-${name.toUpperCase()}`;
    const profileId = uuid(sql(`insert into public.admin_profiles(user_id,admin_code,display_name,is_active,status) values('${userId}','${adminCode}','Synthetic ${name === "target" ? "Target" : name}',true,'active') returning id;`).split(/\r?\n/)[0]);
    sql(`insert into public.rbac_user_platform_roles(user_id,role_id,scope,note) select '${userId}',id,'admin','Disposable fixture' from public.rbac_platform_roles where code='${role}' and scope='admin';`);
    const cookies = [];
    const session = createServerClient(status.API_URL, status.ANON_KEY, { cookies: { getAll: () => cookies, setAll: values => { for (const value of values) { const index = cookies.findIndex(cookie => cookie.name === value.name); if (index >= 0) cookies.splice(index, 1); cookies.push(value); } } } });
    assert.ok(!(await session.auth.signInWithPassword({ email, password })).error, "Synthetic sign-in failed.");
    const account = { email, password, userId, profileId, adminCode, cookies, session };
    if (["voluntary", "super"].includes(name)) {
      const enrollment = await session.auth.mfa.enroll({ factorType: "totp", friendlyName: `Fixture ${name}` });
      assert.ok(!enrollment.error, "Synthetic authenticator enrollment failed.");
      account.factorId = enrollment.data.id; account.secret = enrollment.data.totp.secret;
      const challenge = await session.auth.mfa.challenge({ factorId: account.factorId });
      assert.ok(!challenge.error, "Synthetic authenticator challenge failed.");
      assert.ok(!(await session.auth.mfa.verify({ factorId: account.factorId, challengeId: challenge.data.id, code: totp(account.secret) })).error, "Synthetic authenticator verification failed.");
      if (name === "voluntary") assert.ok(!(await session.auth.signInWithPassword({ email, password })).error, "Synthetic AAL1 sign-in failed.");
    }
    const claims = await session.auth.getClaims(); assert.ok(!claims.error && claims.data.claims.jnuits_role_version >= 0, "Real claim hook not configured.");
    account.sessionId = uuid(claims.data.claims.session_id); accounts.set(name, account);
  }
  for (let index = 0; index < 4; index++) {
    const memberId = uuid(sql(`insert into public.members(jnuits_id,full_name,joined_on,lifecycle_status,portal_access_status) values('JNUITS-209987${index}','Synthetic review member ${index}','2023-01-01','former','frozen') returning id;`).split(/\r?\n/)[0]);
    memberIds.push(memberId);
    if (index < 3) requestIds.push(uuid(sql(`insert into public.profile_update_requests(member_id,request_type,payload) values('${memberId}','alumni_conversion','{}') returning id;`).split(/\r?\n/)[0]));
    else renewalMember = memberId;
  }
  bridge = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.headers.authorization !== `Bearer ${bridgeToken}` || request.method !== "POST") { response.writeHead(403).end(); return; }
    try {
      let raw = ""; for await (const chunk of request) { raw += chunk; if (raw.length > 32_000) throw new Error("Fixture body too large."); }
      const body = JSON.parse(raw); const account = accounts.get(body.name);
      let result; const action = request.url.slice(1);
      const roleIntent = { operation: "admin.role.change", payload: { adminProfileId: accounts.get("target").profileId, roleCode: "admin", confirmation: accounts.get("target").adminCode } };
      if (action === "account") { assert.ok(account); result = { cookies: account.cookies.map(({ name, value }) => ({ name, value })), userId: account.userId, password: account.password, factorId: account.factorId }; }
      else if (action === "transport") { assert.ok([...accounts.values()].some(item => item.email === body.to)); const code = body.html.match(/<code\b[^>]*>\s*([0-9]{6})\s*<\/code>/)?.[1]; assert.ok(code); mail.set(body.to, code); result = { id: "disposable-transport" }; }
      else if (action === "email") { assert.ok(account && mail.has(account.email)); result = { code: mail.get(account.email) }; }
      else if (action === "totp") { assert.ok(account?.secret); result = { code: totp(account.secret) }; }
      else if (action === "policy") { assert.equal(typeof body.enforced, "boolean"); sql(`update public.security_settings set admin_totp_enforced=${body.enforced} where id;`); result = { ok: true }; }
      else if (action === "reset_limits") { assert.ok(account); sql(`delete from private.admin_verification_rate_events where subject_hash='${account.userId}' or kind like '%ip';`); result = { ok: true }; }
      else if (action === "membership_state") result = jsonSql(`select json_build_object('alumni',(select count(*) from public.members where id in (${memberIds.slice(0,3).map(id=>`'${id}'`).join(",")}) and lifecycle_status='alumni'),'frozen',(select count(*) from public.members where id in (${memberIds.slice(0,3).map(id=>`'${id}'`).join(",")}) and portal_access_status='frozen'),'fees',(select count(*) from public.membership_renewals where member_id in (${memberIds.map(id=>`'${id}'`).join(",")})),'reviewed',(select count(*) from public.audit_events where action='membership.membership_request_reviewed' and entity_id in (${memberIds.slice(0,3).map(id=>`'${id}'`).join(",")})));`);
      else if (action === "renewal_state") result = jsonSql(`select json_build_object('count',(select count(*) from public.membership_renewals where member_id='${renewalMember}'),'frozen',(select portal_access_status='frozen' from public.members where id='${renewalMember}'));`);
      else if (action === "renewal_intent") result = { operation: "membership.renewal.confirm", payload: { memberId: renewalMember, expectedDueOn: sql(`select renewal_due_on from public.members where id='${renewalMember}';`), resolution: "paid", reference: "", note: "Synthetic exact office receipt.", confirmation: "CONFIRM" } };
      else if (action === "renewal_rpc") { assert.ok(account && body.intent.payload.memberId === renewalMember); const p = body.intent.payload; const value = await account.session.rpc("confirm_membership_renewal", { p_member_id: renewalMember, p_expected_due_on: p.expectedDueOn, p_resolution: p.resolution, p_reference: p.reference, p_note: p.note, p_proof: body.token }); result = { allowed: !value.error }; }
      else if (action === "role_intent") result = roleIntent;
      else if (action === "role_rpc") { assert.ok(account); assert.deepEqual(body.intent, roleIntent); const value = await account.session.rpc("apply_admin_role_operation", { p_operation: roleIntent.operation, p_payload: roleIntent.payload, p_proof: body.token ?? null }); result = { allowed: !value.error }; }
      else if (action === "target_role") result = { role: sql(`select r.code from public.rbac_user_platform_roles g join public.rbac_platform_roles r on r.id=g.role_id where g.user_id='${accounts.get("target").userId}' and g.scope='admin' and g.revoked_at is null;`) };
      else if (action === "session_assurance") { assert.ok([...accounts.values()].some(item => item.userId === body.userId)); result = { aal: sql(`select aal from auth.sessions where user_id='${uuid(body.userId)}' order by updated_at desc limit 1;`) }; }
      else if (action === "read_proof") { assert.ok(account); result = { reads: Number(sql(`select count(*) from private.admin_verification_proofs p join private.admin_verification_intents i on i.id=p.intent_id where i.user_id='${account.userId}' and i.operation='admin.security.read';`)) }; }
      else if (action === "try_read_proof_write") { assert.ok(account); result = jsonSql(`select json_build_object('allowed',coalesce((public.admin_verification_reserve(jsonb_build_object('actor',(public.admin_verification_context(jsonb_build_object('userId','${account.userId}','sessionId','${account.sessionId}','roleVersion',(select version from public.rbac_user_claim_versions where user_id='${account.userId}'),'currentLevel','aal1'))->'value'),'intent',jsonb_build_object('operation','admin.security.update','payload',jsonb_build_object('adminTotpEnforced',true)),'proofId',p.id,'tokenHash',p.token_hash))->>'ok')::boolean,false)) from private.admin_verification_proofs p join private.admin_verification_intents i on i.id=p.intent_id where i.user_id='${account.userId}' and i.operation='admin.security.read' limit 1;`); }
      else throw new Error("Unknown fixture operation.");
      response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(result));
    } catch { response.writeHead(400).end('{"error":"Disposable fixture rejected."}'); }
  });
  await new Promise(resolve => bridge.listen(0, "127.0.0.1", resolve));
  const bridgeUrl = `http://127.0.0.1:${bridge.address().port}`;
  const env = { ...process.env, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", ADMIN_VERIFICATION_QA: "DISPOSABLE_SCRATCH", ADMIN_VERIFICATION_QA_BRIDGE: bridgeUrl, ADMIN_VERIFICATION_QA_TOKEN: bridgeToken };
  const workflow = readFileSync(join(repo, ".github/workflows/quality-gate.yml"), "utf8");
  for (const match of workflow.split("  build_and_browser:")[1].split("    steps:")[0].matchAll(/^      ([A-Z_]+): (.+)$/gm)) { const value = match[2].trim(); env[match[1]] = value.startsWith('"') ? JSON.parse(value) : value; }
  Object.assign(env, { NEXT_PUBLIC_SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY, SUPABASE_SECRET_KEY: status.SERVICE_ROLE_KEY, APP_BASE_URL: "http://127.0.0.1:3127", NEXT_PUBLIC_SENTRY_DSN: "", SENTRY_AUTH_TOKEN: "", SENTRY_ORG: "", SENTRY_PROJECT: "", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA", TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA" });
  assert.equal(env.AUTH_CAPTCHA_REQUIRED, "true");
  console.log("Synthetic AAL1/AAL2 identities and reviewed-member fixtures are ready.");
  env.NODE_OPTIONS = `--require "${join(repo, "supabase/verification/admin-verification-qa-preload.cjs").replaceAll("\\", "/")}"`;
  next = spawn(process.execPath, [join(repo, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3127"], { cwd: repo, env, stdio: ["ignore", "pipe", "pipe"] });
  let diagnostics = "";
  const capture = chunk => {
    let safe = String(chunk);
    for (const secret of [bridgeToken, status.SERVICE_ROLE_KEY, status.ANON_KEY, ...[...accounts.values()].flatMap(account => [account.password, account.secret].filter(Boolean)), ...mail.values()]) safe = safe.split(secret).join("[redacted]");
    diagnostics = `${diagnostics}${safe.replace(/eyJ[A-Za-z0-9._-]+/g, "[token redacted]").replace(/\b[0-9]{6}\b/g, "[code redacted]")}`.slice(-4000);
  };
  next.stdout.on("data", capture); next.stderr.on("data", capture);
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) { if (next.exitCode !== null) break; try { const response = await fetch("http://127.0.0.1:3127/admin/login", { signal: AbortSignal.timeout(5000) }); if (response.status < 500) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 500)); }
  assert.ok(ready, `Disposable Next.js server not ready. ${diagnostics}`);
  delete env.NODE_OPTIONS;
  Object.assign(env, { PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3127", PLAYWRIGHT_NO_COPY_PROMPT: "1", ADMIN_VERIFICATION_QA_SCREENSHOTS: screenshots, NODE_ENV: "test" });
  console.log("Running real Next/Supabase browser integration; transport does not certify mailbox delivery.");
  const child = spawn(process.execPath, [join(repo, "node_modules/@playwright/test/cli.js"), "test", "e2e/admin-verification.spec.ts", "--project=chromium", "--workers=1", "--output", join(screenshots, "playwright-output"), "--last-failed-file", join(repo, "test-results/playwright/.last-run.json")], { cwd: repo, env, stdio: "inherit" });
  const code = await new Promise(resolve => child.once("exit", resolve));
  if (code !== 0) console.error(`Redacted disposable Next diagnostics: ${diagnostics}`);
  assert.equal(code, 0, "Disposable admin verification browser suite failed.");
  console.log("ADMIN VERIFICATION BROWSER QA PASSED (disposable project only).");
  console.log(`Non-secret screenshots: ${screenshots}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Disposable browser QA failed."); process.exitCode = 1;
} finally {
  if (next) {
    if (process.platform === "win32" && next.pid) spawnSync("taskkill", ["/PID", String(next.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    else next.kill();
    await new Promise(resolve => { if (next.exitCode !== null) resolve(); else { next.once("exit", resolve); setTimeout(resolve, 5000); } });
  }
  if (bridge) await new Promise(resolve => bridge.close(resolve));
  if (started) { try { cli(["stop", "--project-id", projectId, "--no-backup"]); } catch { process.exitCode = 1; console.error("Disposable stack cleanup failed; exact project ID retained in scratch config."); } }
  const target = realpathSync(scratch);
  if (process.exitCode !== 1 && target.startsWith(`${realpathSync(root)}${sep}replay.admin-`) && !existsSync(join(target, "supabase", ".temp", "project-ref"))) rmSync(target, { recursive: true });
}

import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer, request as proxyHttpRequest } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { join, sep } from "node:path";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { disableReplayCatalogCache } from "./configure-bootstrap-replay.mjs";
import { finishLocalProxyError } from "./local-proxy-error.mjs";

// Only creates its own isolated, unlinked project. There is deliberately no
// --db-url, --linked, existing workdir or hosted-credentials argument.
assert.equal(process.argv.length, 2, "Remote database/workdir arguments are forbidden.");
assert.ok(!process.env.ADMIN_VERIFICATION_QA_WORKDIR && !process.env.SUPABASE_DB_URL, "External projects are forbidden.");
const profileQA = process.env.PROFILE_SELF_SERVICE_QA === "DISPOSABLE_SCRATCH";
const adminAuditQA = process.env.ADMIN_AUDIT_QA === "DISPOSABLE_SCRATCH";
assert.ok(!adminAuditQA || profileQA, "Admin audit QA requires production-mode isolated fixtures.");
const memberEditorQA = process.env.MEMBER_EDITOR_QA === "DISPOSABLE_SCRATCH";
assert.ok(!memberEditorQA || profileQA, "Member editor QA requires the isolated profile fixtures.");
const memberEditorProject = process.env.MEMBER_EDITOR_QA_PROJECT;
assert.ok(!memberEditorProject || (memberEditorQA && ["chromium", "firefox", "webkit"].includes(memberEditorProject)), "Only known disposable editor browser projects are allowed.");
const repo = realpathSync(process.cwd());
const root = join(repo, ".replay-scratch"); mkdirSync(root, { recursive: true });
const scratch = mkdtempSync(join(root, "replay.admin-"));
assert.ok(realpathSync(scratch).startsWith(`${realpathSync(root)}${sep}replay.admin-`));
const runId = randomBytes(6).toString("hex");
const projectId = `jnuits-admin-qa-${runId}`;
const dbContainer = `supabase_db_${projectId}`;
const bridgeToken = randomBytes(32).toString("base64url");
const screenshots = memberEditorQA ? join(repo, "artifacts/reports/member-editor-browser") : mkdtempSync(join(tmpdir(), "jnuits-admin-qa-"));
mkdirSync(screenshots, { recursive: true });
const require = createRequire(join(repo, "package.json"));
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");
const accounts = new Map(); const mail = new Map(); const memberIds = []; const requestIds = [];
let next; let tlsProxy; let bridge; let started = false; let renewalMember;
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
  // CLI 2.109.1 names the mail section local_smtp; older configs use inbucket.
  // Both must stay on our fixture port, not another project's default 54324.
  const ports = { api: 55761, db: 55762, "db.pooler": 55769, studio: 55763, inbucket: 55764, local_smtp: 55764 };
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
  {
    // Public Auth keeps native CAPTCHA enabled. This is a newly-created local
    // project with Cloudflare's documented testing secret, never hosted config.
    assert.ok(!/^\[auth.captcha\]/m.test(config));
    config += '\n[auth.captcha]\nenabled = true\nprovider = "turnstile"\nsecret = "1x0000000000000000000000000000000AA"\n';
  }
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
  sql("grant select on all tables in schema public to service_role; grant insert,update on public.profile_update_requests to service_role; grant insert on public.audit_events to service_role; update public.security_settings set admin_totp_enforced=false where id;");
  // Hosted service_role UPDATE on members was independently verified; mirror it
  // only in this isolated editor fixture. Browser grants and RLS stay unchanged.
  if (memberEditorQA) sql("grant update on public.members to service_role;");
  if (profileQA) sql("insert into public.departments(code,name,short_code,is_active) values('CSE','Computer Science & Engineering','CSE',true) on conflict do nothing;");
  for (const [name, role] of [["never", "super_admin"], ["voluntary", "super_admin"], ["super", "super_admin"], ["target", "content_admin"], ["setup", "super_admin"], ...(profileQA ? [["profile", "alumni"], ["completionmember","member"], ["completionalumni","alumni"], ["completionadmin","content_admin"]] : []), ...(adminAuditQA ? [["audit", "content_admin"], ["activityreader", "admin"]] : [])]) {
    const email = `qa-${name}-${runId}@local.invalid`, password = `Qa!${randomBytes(18).toString("base64url")}`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert.ok(!created.error && created.data.user, "Synthetic account creation failed.");
    const userId = uuid(created.data.user.id);
    const adminCode = `JNUITS-ADMIN-QA-${name.toUpperCase()}`;
    const memberFixture = ["profile","completionmember","completionalumni"].includes(name);
    const profileId = memberFixture
      ? uuid(sql(`insert into public.members(user_id,jnuits_id,full_name,email,member_type,lifecycle_status,portal_access_status,student_id,batch_no,graduation_year,current_organization,phone,professional_visibility) values('${userId}','${name === 'profile' ? 'JnUITS-2099961' : name === 'completionmember' ? 'JnUITS-2099957' : 'JnUITS-2099956'}','${name === 'profile' ? 'Synthetic Profile Alumni' : 'Synthetic Completion Profile'}','${email}','${role === 'member' ? 'current' : 'alumni'}','${role === 'member' ? 'current' : 'alumni'}','active','${name === 'profile' ? 'ST-OLD' : 'ST-' + name}',17,2026,'Original Workplace','01700000000','private') returning id;`).split(/\r?\n/)[0])
      : uuid(sql(`insert into public.admin_profiles(user_id,admin_code,display_name,is_active,status) values('${userId}','${adminCode}','Synthetic ${name === "target" ? "Target" : name}',true,'active') returning id;`).split(/\r?\n/)[0]);
    sql(`insert into public.rbac_user_platform_roles(user_id,role_id,scope,note) select '${userId}',id,'${memberFixture ? "portal" : "admin"}','Disposable fixture' from public.rbac_platform_roles where code='${role}' and scope='${memberFixture ? "portal" : "admin"}';`);
    if (name.startsWith("completion")) sql(`update public.members set department_code=(select code from public.departments where upper(short_code)='CSE' limit 1), current_organization='Synthetic Workplace',designation='Engineer',work_location='Dhaka',current_membership_path_status='open',renewal_due_on=(current_date+interval '1 year')::date where id='${profileId}';`);
    if (name === "completionadmin") {
      sql(`insert into public.members(user_id,jnuits_id,full_name,email,member_type,lifecycle_status,portal_access_status,department_code,batch_no,student_id,current_membership_path_status,renewal_due_on,professional_visibility) values('${userId}','JnUITS-2099955','Synthetic Linked Admin','${email}','current','current','active',(select code from public.departments where upper(short_code)='CSE' limit 1),17,'ST-completionadmin','open',(current_date+interval '1 year')::date,'private');`);
      sql(`insert into public.rbac_user_platform_roles(user_id,role_id,scope,note) select '${userId}',id,'portal','Disposable linked admin' from public.rbac_platform_roles where code='member' and scope='portal';`);
    }
    const cookies = [];
    // Trusted fixture seeding bypasses CAPTCHA; after sign-in, requests use
    // the synthetic user's JWT. Application browser clients stay publishable.
    const session = createServerClient(status.API_URL, status.SERVICE_ROLE_KEY, { cookies: { getAll: () => cookies, setAll: values => { for (const value of values) { const index = cookies.findIndex(cookie => cookie.name === value.name); if (index >= 0) cookies.splice(index, 1); cookies.push(value); } } } });
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
    assert.equal(claims.data.claims.role, "authenticated", "Fixtures must use a user JWT, not a service role.");
    account.sessionId = uuid(claims.data.claims.session_id); accounts.set(name, account);
    if (name === "never") {
      const publicAuth = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const rejected = await publicAuth.auth.signInWithPassword({ email, password });
      assert.equal(rejected.error?.code, "captcha_failed", "Native public Auth must still require CAPTCHA.");
      console.log("Native public Auth rejected a CAPTCHA-free login; trusted synthetic seeding succeeded.");
    }
  }
  for (let index = 0; index < 4; index++) {
    const memberId = uuid(sql(`insert into public.members(jnuits_id,full_name,joined_on,lifecycle_status,portal_access_status) values('JNUITS-209987${index}','Synthetic review member ${index}','2023-01-01','former','frozen') returning id;`).split(/\r?\n/)[0]);
    memberIds.push(memberId);
    if (index < 3) requestIds.push(uuid(sql(`insert into public.profile_update_requests(member_id,request_type,payload) values('${memberId}','alumni_conversion','{}') returning id;`).split(/\r?\n/)[0]));
    else renewalMember = memberId;
  }
  const resetAuditFixtures = () => {
    assert.ok(adminAuditQA);
    sql(`grant insert,update on public.content_pages,public.projects to service_role; grant update on public.admin_profiles to service_role;
      insert into public.content_pages(slug,title,status,body) values('home','Synthetic Home','published','{"stats":[{"value":"preserve"}],"sliderImages":["preserve"],"future":{"preserve":true},"heroSlides":[{"title":"First","effect":"fade"},{"title":"Second"}],"aboutSection":{"title":"About","future":true}}') on conflict(slug) do update set title=excluded.title,status=excluded.status,body=excluded.body;
      insert into public.projects(id,slug,title,tagline,category,status,cover_image_url,is_featured,started_at) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','synthetic-audit-project','Synthetic Audit Project','Preserved tagline','web','active','https://example.com/fixture-cover.jpg',true,'2026-01-01') on conflict(id) do update set title=excluded.title,tagline=excluded.tagline,status=excluded.status,cover_image_url=excluded.cover_image_url,is_featured=excluded.is_featured;
      insert into public.advisor_profiles(id,advisor_jnuits_id,full_name,advisor_type,is_current,is_public,department) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','JNUITS-RA0099','Synthetic Audit Advisor','honorable_advisor',true,true,'CSE') on conflict(id) do update set full_name=excluded.full_name,is_current=true,is_public=true;
      insert into public.audit_events(actor_user_id,action,entity_type,entity_id,metadata) values('${uuid(accounts.get("audit").userId)}','fixture.audit_acceptance','fixture','fixture','{}');`);
  };
  if (adminAuditQA) resetAuditFixtures();
  bridge = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.headers.authorization !== `Bearer ${bridgeToken}` || request.method !== "POST") { response.writeHead(403).end(); return; }
    try {
      let raw = ""; for await (const chunk of request) { raw += chunk; if (raw.length > 32_000) throw new Error("Fixture body too large."); }
      const body = JSON.parse(raw); const account = accounts.get(body.name);
      let result; const action = request.url.slice(1);
      const roleIntent = { operation: "admin.role.change", payload: { adminProfileId: accounts.get("target").profileId, roleCode: "admin", confirmation: accounts.get("target").adminCode } };
      if (action === "account") { assert.ok(account); result = { cookies: account.cookies.map(({ name, value }) => ({ name, value })), userId: account.userId, password: account.password, factorId: account.factorId }; }
      else if (action === "completion_reset") {
        assert.ok(profileQA && account && ["completionmember","completionalumni"].includes(body.name));
        // This bridge can reach only its freshly created, unlinked disposable
        // database. Do not let earlier serial browser suites consume the next
        // fixture's IP bucket; real limits and rejection behavior stay enabled.
        sql("delete from public.security_rate_limits;");
        sql(`update public.members set current_organization='Synthetic Workplace',designation='Engineer',work_location='Dhaka',workplace_applicability='applicable' where id='${uuid(account.profileId)}';`); result={ok:true};
      }
      else if (action === "audit_reset") { resetAuditFixtures(); result = {ok:true}; }
      else if (action === "activity_reset") {
        assert.ok(adminAuditQA);
        const actorId = uuid(accounts.get("never").userId);
        sql(`delete from public.security_rate_limits; update public.security_settings set admin_totp_enforced=false;
          delete from private.admin_activity_events; delete from private.admin_activity_receipts; delete from private.admin_activity_summaries;
          update private.admin_activity_ingestion_state set lease_id=null,lease_until=null,purge_enabled=false;
          delete from public.rbac_role_permissions where role_id=(select id from public.rbac_platform_roles where code='admin'and scope='admin')and permission_code='admin.security.read';
          do $fixture$ begin for i in 1..126 loop
           perform private.admin_activity_append(jsonb_build_object('id',extensions.gen_random_uuid(),'source','application_commit','sourceId','fixture:'||i,'actorUserId','${actorId}','targetUserId',null,'action','fixture.work','outcome','succeeded','occurredAt',transaction_timestamp(),'recordedAt',clock_timestamp(),'context',jsonb_build_object('observedIp','198.51.100.20','clientIp',null,'countryCode',null,'browser','Synthetic browser','os','Synthetic OS','deviceClass','desktop','networkSource','vercel_edge'),'provenance','Disposable committed source fixture'),false);
          end loop; end $fixture$;`);
        assert.ok(!(await accounts.get("activityreader").session.auth.refreshSession()).error, "Synthetic permission refresh failed.");
        result = {ok:true};
      }
      else if (action === "activity_state") {
        assert.ok(adminAuditQA && account);
        result = jsonSql(`select json_build_object('workCount',coalesce((select completed_work_count from private.admin_activity_summaries where user_id='${uuid(account.userId)}'),0),'entries',(select count(*)from private.admin_activity_events where source='workspace_entry'and actor_user_id='${uuid(account.userId)}'),'access',(select count(*)from private.admin_activity_events where source='workspace_access'and actor_user_id='${uuid(account.userId)}'));`);
      }
      else if (action === "activity_previous_day") {
        assert.ok(adminAuditQA && account);
        const id=uuid(account.userId);
        // Move only this synthetic session's prior daily receipt to yesterday.
        // The application/DB clocks and real sessions are never overridden.
        sql(`update private.admin_activity_receipts set source_id='access:${id}:'||((clock_timestamp()at time zone 'UTC')::date-1)::text where source='workspace_access'and actor_user_id='${id}';
          update private.admin_activity_events set source_id='access:${id}:'||((clock_timestamp()at time zone 'UTC')::date-1)::text,occurred_at=clock_timestamp()-interval '1 day'where source='workspace_access'and actor_user_id='${id}';
          update private.admin_activity_summaries set last_workspace_access_at=clock_timestamp()-interval '1 day'where user_id='${id}';`);
        result={ok:true};
      }
      else if (action === "activity_collect") {
        assert.ok(adminAuditQA);
        const lease = jsonSql("select public.claim_admin_accountability_job();"); assert.ok(lease.claimed);
        try { result = jsonSql(`select public.collect_admin_auth_activity(500,false,'${uuid(lease.leaseId)}');`); }
        finally { sql(`select public.release_admin_accountability_job('${uuid(lease.leaseId)}');`); }
      }
      else if (action === "activity_password_state") {
        assert.ok(adminAuditQA && account && body.name === "completionadmin");
        if (body.password !== undefined) {
          assert.ok(typeof body.password === "string" && body.password.length < 256);
          // Native password changes invalidate the older fixture session. Issue
          // a fresh real session and SSR cookies before the next engine uses it.
          const checked=await account.session.auth.signInWithPassword({email:account.email,password:body.password});
          assert.ok(!checked.error && checked.data.user?.id === account.userId,"Synthetic password acceptance failed.");
          const claims=await account.session.auth.getClaims();
          assert.ok(!claims.error && claims.data.claims.role === "authenticated","Synthetic replacement session failed.");
          account.sessionId=uuid(claims.data.claims.session_id); account.password=body.password;
        }
        result=jsonSql(`select json_build_object('providerPasswordIds',(select coalesce(json_agg(id order by id),'[]')from auth.audit_log_entries where payload->>'actor_id'='${uuid(account.userId)}'and payload->>'action'='user_updated_password'),'projectedPasswordIds',(select coalesce(json_agg(source_id order by source_id),'[]')from private.admin_activity_events where actor_user_id='${uuid(account.userId)}'and source='native_auth'and action='auth.user_updated_password'));`);
      }
      else if (action === "audit_state") { assert.ok(adminAuditQA); result=jsonSql("select json_build_object('home',(select body from public.content_pages where slug='home'),'project',(select json_build_object('title',title,'tagline',tagline,'cover',cover_image_url,'featured',is_featured,'status',status) from public.projects where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')); "); }
      else if (action === "audit_conflict") { assert.ok(adminAuditQA); sql("update public.content_pages set title='Concurrent synthetic edit' where slug='home';"); result={ok:true}; }
      else if (action === "transport") { assert.ok([...accounts.values()].some(item => item.email === body.to)); const code = body.html.match(/<code\b[^>]*>\s*([0-9]{6})\s*<\/code>/)?.[1]; if (code) mail.set(body.to, code); result = { id: "disposable-transport" }; }
      else if (action === "profile_password_state") {
        assert.ok(profileQA && typeof body.password === "string" && body.password.length < 256);
        const profile = accounts.get("profile");
        const verify = async password => {
          const client = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
          const checked = await client.auth.signInWithPassword({ email: profile.email, password });
          const matches = !checked.error && checked.data.user?.id === profile.userId;
          if (checked.data.user) await client.auth.signOut({ scope: "local" });
          return matches;
        };
        result = { newPasswordAccepted: await verify(body.password), oldPasswordRejected: !(await verify(profile.password)) };
      }
      else if (action === "profile_state") { assert.ok(profileQA); const id = uuid(accounts.get("profile").profileId); result = jsonSql(`select json_build_object('organization',m.current_organization,'phone',m.phone,'studentId',m.student_id,'batch',m.batch_no,'graduationYear',m.graduation_year,'requests',(select coalesce(json_agg(json_build_object('id',q.id,'type',q.request_type,'status',q.status)),'[]') from public.profile_update_requests q where q.member_id=m.id)) from public.members m where m.id='${id}';`); }
      else if (action === "profile_conflict") { assert.ok(profileQA); const id = uuid(accounts.get("profile").profileId); const requestId = uuid(sql(`select id from public.profile_update_requests where member_id='${id}' and request_type='workplace_update' and status='pending' limit 1;`)); const value = await admin.rpc("review_member_profile_update", { p_request_id: requestId, p_actor_user_id: accounts.get("never").userId, p_decision: "approved", p_review_note: "Synthetic conflict check" }); result = { code: value.error?.code, status: value.status }; }
      else if (action === "workplace_request") { assert.ok(profileQA); assert.ok(["Initial Requested Workplace","Obsolete Workplace"].includes(body.organization)); const id = uuid(accounts.get("profile").profileId); result = { id: uuid(sql(`insert into public.profile_update_requests(member_id,request_type,status,payload,requested_at) values('${id}','workplace_update','pending',jsonb_build_object('currentOrganization','${body.organization}'),clock_timestamp()+interval '10 years') returning id;`).split(/\r?\n/)[0]) }; }
      else if (action === "email") { assert.ok(account && mail.has(account.email)); result = { code: mail.get(account.email) }; }
      else if (action === "totp") { assert.ok(account?.secret); result = { code: totp(account.secret) }; }
      else if (action === "setup_totp") {
        assert.equal(body.name, "setup"); assert.ok(account);
        assert.match(body.secret, /^[A-Z2-7]{16,128}$/);
        account.secret = body.secret; // In-memory only; included in diagnostic redaction.
        result = { code: totp(account.secret) };
      }
      else if (action === "policy") { assert.equal(typeof body.enforced, "boolean"); sql(`update public.security_settings set admin_totp_enforced=${body.enforced} where id;`); result = { ok: true }; }
      else if (action === "reset_limits") { assert.ok(account); sql(`delete from private.admin_verification_rate_events where subject_hash='${account.userId}' or kind like '%ip';`); result = { ok: true }; }
      else if (action === "expire_retention_read") { assert.ok(account); sql(`update private.admin_verification_proofs p set expires_at=clock_timestamp()-interval '1 second' from private.admin_verification_intents i where i.id=p.intent_id and i.user_id='${account.userId}' and i.session_id='${account.sessionId}' and i.operation='admin.retention.read';`); result = { ok: true }; }
      else if (action === "retention_discovery_state") { assert.ok(account); result = { completed: Number(sql(`select count(*) from public.audit_events where actor_user_id='${account.userId}' and action='retention.discovery_completed';`)) }; }
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
  // Match the production durable limiter with a fresh disposable salt.
  env.RATE_LIMIT_BACKEND = "supabase";
  env.RATE_LIMIT_SECRET_SALT = randomBytes(32).toString("hex");
  console.log("Synthetic AAL1/AAL2 identities and reviewed-member fixtures are ready.");
  env.NODE_OPTIONS = `--require "${join(repo, "supabase/verification/admin-verification-qa-preload.cjs").replaceAll("\\", "/")}"`;
  let diagnostics = "";
  const capture = chunk => {
    let safe = String(chunk);
    for (const secret of [bridgeToken, status.SERVICE_ROLE_KEY, status.ANON_KEY, env.RATE_LIMIT_SECRET_SALT, ...[...accounts.values()].flatMap(account => [account.password, account.secret].filter(Boolean)), ...mail.values()]) safe = safe.split(secret).join("[redacted]");
    diagnostics = `${diagnostics}${safe.replace(/eyJ[A-Za-z0-9._-]+/g, "[token redacted]").replace(/\b[0-9]{6}\b/g, "[code redacted]")}`.slice(-4000);
  };
  if (profileQA) {
    env.NODE_ENV = "production";
    console.log("Building the real production application for profile acceptance.");
    const { validateEnv } = await import(pathToFileURL(join(repo, "scripts/validate-env.mjs")).href);
    const validation = validateEnv(env, { production: true });
    // Exactly three isolated-fixture exceptions: HTTP loopback Auth/app and
    // disabled Sentry delivery. The deployment validator is never weakened.
    assert.deepEqual(validation.missing, ["NEXT_PUBLIC_SENTRY_DSN"]);
    assert.deepEqual(validation.invalid, ["NEXT_PUBLIC_SUPABASE_URL must be a valid https URL.", "APP_BASE_URL must be a valid https URL."]);
    console.log("Fixture-only config exceptions: HTTP loopback and disabled Sentry; deployment validation unchanged.");
    const build = spawn(process.execPath, [join(repo, "node_modules/next/dist/bin/next"), "build"], { cwd: repo, env, stdio: ["ignore", "pipe", "pipe"] });
    build.stdout.on("data", capture); build.stderr.on("data", capture);
    assert.equal(await new Promise(resolve => build.once("exit", resolve)), 0, `Disposable production build failed. ${diagnostics}`);
    console.log("Production build passed. Starting production-mode browser acceptance.");
  }
  next = spawn(process.execPath, [join(repo, "node_modules/next/dist/bin/next"), ...(profileQA ? ["start"] : ["dev", "--webpack"]), "--hostname", "127.0.0.1", "--port", "3127"], { cwd: repo, env, stdio: ["ignore", "pipe", "pipe"] });
  next.stdout.on("data", capture); next.stderr.on("data", capture);
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) { if (next.exitCode !== null) break; try { const response = await fetch("http://127.0.0.1:3127/admin/login", { signal: AbortSignal.timeout(5000) }); if (response.status < 500) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 500)); }
  assert.ok(ready, `Disposable Next.js server not ready. ${diagnostics}`);
  if (profileQA) {
    const tlsKey = join(scratch, "fixture-tls.key"), tlsCert = join(scratch, "fixture-tls.crt");
    const openssl = process.platform === "win32" ? "C:/Program Files/Git/usr/bin/openssl.exe" : "openssl";
    const tlsConfig = join(scratch, "fixture-openssl.cnf");
    writeFileSync(tlsConfig, "[req]\ndistinguished_name=dn\n[dn]\nCN=127.0.0.1\n");
    execFileSync(openssl, ["req","-x509","-newkey","rsa:2048","-nodes","-keyout",tlsKey,"-out",tlsCert,"-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1","-config",tlsConfig], {stdio:"ignore",windowsHide:true});
    // Local TLS terminator preserves real production Secure cookies in WebKit.
    // Only disposable browsers trust this one-day certificate; no OS trust change.
    tlsProxy = createHttpsServer({key:readFileSync(tlsKey),cert:readFileSync(tlsCert)}, (incoming,outgoing)=>{
      const upstream = proxyHttpRequest({hostname:"127.0.0.1",port:3127,path:incoming.url,method:incoming.method,headers:{...incoming.headers,"x-forwarded-proto":"https","x-forwarded-host":incoming.headers.host}},result=>{
        outgoing.writeHead(result.statusCode || 502,result.headers);result.pipe(outgoing);
      });
      upstream.on("error",()=>finishLocalProxyError(outgoing));incoming.pipe(upstream);
    });
    await new Promise((resolve,reject)=>{tlsProxy.once("error",reject);tlsProxy.listen(3130,"127.0.0.1",resolve);});
    env.PROFILE_COMPLETION_QA_BASE_URL = "https://127.0.0.1:3130";
  }
  delete env.NODE_OPTIONS;
  if (memberEditorQA || adminAuditQA) env.PLAYWRIGHT_RELEASE_SMOKE = "1";
  Object.assign(env, { PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3127", PLAYWRIGHT_NO_COPY_PROMPT: "1", ADMIN_VERIFICATION_QA_SCREENSHOTS: screenshots, NODE_ENV: "test" });
  console.log("Running real Next/Supabase browser integration; transport does not certify mailbox delivery.");
  // Reuse this isolated stack/build for private password acceptance before the
  // editor matrix. Each suite has its own browser context and artifact folder.
  // A failed mutable scenario may leave partial fixture state. Never retry it
  // automatically against that same database; rerun the isolated harness instead.
  const suites = memberEditorQA
    ? [["e2e/admin-verification.spec.ts", ["--project=chromium"]], ["e2e/profile-self-service.spec.ts", ["--project=chromium"]], ["e2e/member-editor.spec.ts", memberEditorProject ? [`--project=${memberEditorProject}`] : []]]
    : [[profileQA ? "e2e/profile-self-service.spec.ts" : "e2e/admin-verification.spec.ts", ["--project=chromium"]]];
  if (profileQA) { env.PLAYWRIGHT_RELEASE_SMOKE = "1"; suites.push(["e2e/profile-completion.spec.ts", (process.env.PROFILE_COMPLETION_QA_PROJECTS ? process.env.PROFILE_COMPLETION_QA_PROJECTS.split(",").map(project=>{assert.ok(["chromium","firefox","webkit"].includes(project));return `--project=${project}`;}) : [])]); }
  if (adminAuditQA) suites.unshift(["e2e/admin-audit-normalization.spec.ts", memberEditorProject ? [`--project=${memberEditorProject}`] : []]);
  if (adminAuditQA) suites.push(["e2e/admin-activity.spec.ts", (process.env.ADMIN_ACTIVITY_QA_PROJECTS ? process.env.ADMIN_ACTIVITY_QA_PROJECTS.split(",").map(project=>{assert.ok(["chromium","firefox","webkit"].includes(project));return `--project=${project}`;}) : [])]);
  const activityOnly = process.env.ADMIN_ACTIVITY_QA_ONLY === "DISPOSABLE_SCRATCH";
  assert.ok(!activityOnly || adminAuditQA, "Focused activity QA requires the same disposable production fixtures.");
  for (const [index, [spec, projects]] of (activityOnly ? suites.filter(([spec])=>spec === "e2e/admin-activity.spec.ts") : suites).entries()) {
    const child = spawn(process.execPath, [join(repo, "node_modules/@playwright/test/cli.js"), "test", spec, ...projects, "--workers=1", "--retries=0", "--output", join(screenshots, `playwright-output-${index}`), "--last-failed-file", join(repo, "test-results/playwright/.last-run.json")], { cwd: repo, env, stdio: "inherit" });
    const code = await new Promise(resolve => child.once("exit", resolve));
    if (code !== 0) console.error(`Redacted disposable Next diagnostics: ${diagnostics}`);
    assert.equal(code, 0, `Disposable browser suite failed: ${spec}`);
  }
  console.log(profileQA ? "PROFILE SELF SERVICE BROWSER QA PASSED (disposable project only)." : "ADMIN VERIFICATION BROWSER QA PASSED (disposable project only).");
  console.log(`Non-secret screenshots: ${screenshots}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Disposable browser QA failed."); process.exitCode = 1;
} finally {
  if (next) {
    if (process.platform === "win32" && next.pid) spawnSync("taskkill", ["/PID", String(next.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    else next.kill();
    await new Promise(resolve => { if (next.exitCode !== null) resolve(); else { next.once("exit", resolve); setTimeout(resolve, 5000); } });
  }
  if (tlsProxy) await new Promise(resolve => tlsProxy.close(resolve));
  if (bridge) await new Promise(resolve => bridge.close(resolve));
  if (started) { try { cli(["stop", "--project-id", projectId, "--no-backup"]); } catch { process.exitCode = 1; console.error("Disposable stack cleanup failed; exact project ID retained in scratch config."); } }
  const target = realpathSync(scratch);
  if (process.exitCode !== 1 && target.startsWith(`${realpathSync(root)}${sep}replay.admin-`) && !existsSync(join(target, "supabase", ".temp", "project-ref"))) rmSync(target, { recursive: true });
}

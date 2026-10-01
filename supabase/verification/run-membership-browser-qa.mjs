import { createRequire } from "node:module";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const repo = process.cwd();
const scratch = process.env.MEMBERSHIP_BROWSER_QA_WORKDIR;
assert.ok(scratch, "Set MEMBERSHIP_BROWSER_QA_WORKDIR to the disposable Supabase project directory.");
// Windows-local verification only: endpoint, project and Docker target are pinned.
// No hosted account, password, key or database is read or changed.
const require = createRequire(`${repo}/package.json`);
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");
const { chromium } = require("playwright");
const statusCommand = spawnSync("cmd.exe", ["/d", "/s", "/c", "npx", "--yes", "supabase@2.109.1", "status", "--output", "json", "--workdir", scratch], { encoding: "utf8" });
if (statusCommand.status !== 0) throw new Error("Local status unavailable; no credentials were printed.");
const status = JSON.parse(statusCommand.stdout.slice(statusCommand.stdout.indexOf("{")));
const api = status.API_URL;
assert.equal(api, "http://127.0.0.1:55721", "Refusing a non-disposable API endpoint");
const config = readFileSync(`${scratch}/supabase/config.toml`, "utf8");
assert.match(config, /^project_id = "jnuits-membership-qa-20261001"/m);
const localAdmin = createClient(api, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const sql = query => execFileSync("docker", ["exec", "supabase_db_jnuits-membership-qa-20261001", "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", query], { encoding: "utf8" }).trim();
// Existing hosted tables retain these server SELECT grants. CLI 2.109.1's
// fresh opt-in exposure default differs. No browser privileges are widened.
sql("grant select on public.members, public.profile_update_requests, public.portal_user_settings, public.membership_lifecycle_events, public.departments, public.advisor_profiles to service_role;");
const states = ["paid", "grace", "former", "pending", "appealable", "final", "alumni", "frozen"];
const accounts = [];
const existingUsers = await localAdmin.auth.admin.listUsers();
if (existingUsers.error) throw new Error("Cannot inspect the disposable fixture users.");
for (const [index, state] of states.entries()) {
  const email = `qa-${state}@local.invalid`;
  const password = `Qa!${randomBytes(18).toString("base64url")}`;
  const existingUser = existingUsers.data.users.find(user => user.email === email);
  const { data, error } = existingUser ? await localAdmin.auth.admin.updateUserById(existingUser.id, { password }) : await localAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Synthetic account creation failed (${state}): ${error?.message}`);
  const userId = data.user.id; assert.match(userId, /^[0-9a-f-]{36}$/);
  const joined = state === "grace" ? "((now() at time zone 'Asia/Dhaka')::date - interval '1 year 1 month')::date"
    : ["paid", "frozen"].includes(state) ? "(now() at time zone 'Asia/Dhaka')::date - 14"
    : "((now() at time zone 'Asia/Dhaka')::date - interval '2 years')::date";
  const existingMember = sql(`select id from public.members where jnuits_id='JNUITS-20998${String(index + 1).padStart(2,"0")}' and user_id='${userId}';`);
  const memberId = existingMember || sql(`insert into public.members(jnuits_id,full_name,email,user_id,is_profile_claimed,joined_on,portal_access_status) values ('JNUITS-20998${String(index + 1).padStart(2,"0")}', 'Synthetic ${state} Member', '${email}', '${userId}', true, ${joined}, '${state === "frozen" ? "frozen" : "active"}') returning id;`).split(/\r?\n/)[0];
  assert.match(memberId, /^[0-9a-f-]{36}$/);
  if (!existingMember) sql(`insert into public.rbac_user_platform_roles(user_id,role_id,scope,note) select '${userId}', id, 'portal', 'Synthetic browser fixture' from public.rbac_platform_roles where scope='portal' and code='${state === "alumni" ? "alumni" : "member"}';`);
  if (state === "alumni") sql(`update public.members set lifecycle_status='alumni', member_type='alumni' where id='${memberId}';`);
  if (!existingMember && ["pending", "appealable", "final"].includes(state)) {
    sql(`update public.members set lifecycle_status='former' where id='${memberId}';`);
    const requestId = sql(`insert into public.profile_update_requests(member_id,request_type,status,payload) values ('${memberId}','membership_departure','${state === "pending" ? "pending" : "approved"}','{}') returning id;`).split(/\r?\n/)[0];
    sql(`update public.members set current_membership_path_status='${state === "pending" ? "departure_requested" : state === "appealable" ? "closed_appealable" : "closed_final"}', current_membership_case_id='${requestId}' where id='${memberId}';`);
  }
  const diagnostic = await localAdmin.from("members").select("id").eq("user_id", userId).maybeSingle();
  if (diagnostic.error) throw new Error(`Disposable service lookup failed: ${diagnostic.error.code}: ${diagnostic.error.message}`);
  const cookies = [];
  const sessionClient = createServerClient(api, status.ANON_KEY, { cookies: { getAll: () => cookies, setAll: values => { for (const value of values) { const index = cookies.findIndex(cookie => cookie.name === value.name); if (index >= 0) cookies.splice(index,1); cookies.push(value); } } } });
  const signedIn = await sessionClient.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw new Error(`Synthetic local sign-in failed (${state}): ${signedIn.error.message}`);
  accounts.push({ state, memberId, sessionClient, cookies });
}
const workflow = readFileSync(`${repo}/.github/workflows/quality-gate.yml`, "utf8");
const job = workflow.split("  build_and_browser:")[1].split("    steps:")[0];
const env = { ...process.env, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1" };
for (const key of ["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"]) delete env[key];
for (const match of job.matchAll(/^      ([A-Z_]+): (.+)$/gm)) { const value = match[2].trim(); env[match[1]] = value.startsWith('"') ? JSON.parse(value) : value; }
Object.assign(env, { NEXT_PUBLIC_SUPABASE_URL: api, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY, SUPABASE_SECRET_KEY: status.SERVICE_ROLE_KEY, APP_BASE_URL: "http://127.0.0.1:3119" });
assert.equal(env.AUTH_CAPTCHA_REQUIRED, "true");
const server = spawn(process.execPath, [`${repo}/node_modules/next/dist/bin/next`, "dev", "--hostname", "127.0.0.1", "--port", "3119"], { cwd: repo, env, stdio: ["ignore", "pipe", "pipe"] });
let diagnostics = "";
server.stdout.on("data", data => { diagnostics = `${diagnostics}${data}`.slice(-12000); });
server.stderr.on("data", data => { diagnostics = `${diagnostics}${data}`.slice(-12000); });
const browser = await chromium.launch({ headless: true }); let combinations = 0;
try {
  for (let attempt = 0; attempt < 120; attempt++) { try { const response = await fetch("http://127.0.0.1:3119/portal/login"); if (response.status < 500) break; } catch {} await new Promise(resolve => setTimeout(resolve, 500)); if (attempt === 119) throw new Error("Local Next.js did not become ready."); }
  for (const account of accounts) {
    const context = await browser.newContext();
    await context.addCookies(account.cookies.map(({ name, value }) => ({ name, value, domain: "127.0.0.1", path: "/", sameSite: "Lax" })));
    const page = await context.newPage(); const errors = [];
    page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(20000);
    page.on("pageerror", error => errors.push(error.message));
    for (const theme of ["light", "dark"]) for (const width of [375,768,1024,1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(theme => localStorage.setItem("jnuits-theme", theme), theme);
      const response = await page.goto("http://127.0.0.1:3119/portal/membership", { waitUntil: "networkidle" });
      assert.ok(response.status() < 500, `${account.state} returned ${response.status()}`);
      const body = await page.locator("body").innerText();
      assert.ok(!/Application error|Runtime Error|Internal Server Error/.test(body), `${account.state}: runtime error`);
      if (["former","pending","appealable","final"].includes(account.state)) { assert.equal(new URL(page.url()).pathname, "/portal/membership"); assert.ok(body.includes("Former member")); assert.equal(await page.getByRole("link", { name: "Edit Profile", exact: true }).count(), 0); }
      if (account.state === "paid") assert.ok(body.includes("Membership current"));
      if (account.state === "grace") assert.ok(body.includes("Renewal overdue — grace period"));
      if (account.state === "pending") assert.ok(body.includes("Your departure is awaiting review"));
      if (account.state === "appealable") assert.ok(body.includes("You may submit one appeal"));
      if (account.state === "final") assert.ok(body.includes("permanently closed"));
      if (account.state === "alumni") assert.ok(new URL(page.url()).pathname !== "/portal/membership");
      if (account.state === "frozen") assert.ok(/access-pending|login/.test(new URL(page.url()).pathname), "Frozen member reached mutable membership surface");
      const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
      assert.ok(overflow <= 2, `${account.state} ${theme} ${width}: ${overflow}px overflow`);
      if (account.state === "former" && theme === "dark" && width === 375) await page.screenshot({ path: `${scratch}/authenticated-former-375-dark.png`, fullPage: true });
      combinations++;
    }
    if (["former","pending","appealable","final"].includes(account.state)) {
      await page.goto("http://127.0.0.1:3119/portal/profile/edit", { waitUntil: "networkidle" });
      assert.equal(new URL(page.url()).pathname, "/portal/membership", "Former direct edit did not redirect");
      const missingOrigin = await context.request.patch("http://127.0.0.1:3119/api/portal/workplace-requests", { data: { requestId: "11111111-1111-4111-8111-111111111111" } });
      assert.equal(missingOrigin.status(), 403, "Missing-origin direct mutation bypassed CSRF protection");
      const workplace = await context.request.patch("http://127.0.0.1:3119/api/portal/workplace-requests", { headers: { Origin: "http://127.0.0.1:3119", "Sec-Fetch-Site": "same-origin" }, data: { requestId: "11111111-1111-4111-8111-111111111111" } });
      assert.equal(workplace.status(), 423, "Former direct mutation was not restricted");
      const forbidden = await account.sessionClient.rpc("confirm_membership_renewal", { p_member_id: account.memberId, p_expected_due_on: "2025-01-01", p_resolution: "paid" });
      assert.ok(forbidden.error?.code === "42501", "Ordinary member directly confirmed a renewal");
    }
    if (account.state === "former") {
      await page.getByLabel("Type LEAVE JNUITS to confirm").fill("LEAVE JNUITS");
      await page.getByRole("button", { name: "Leave JnUITS", exact: true }).click();
      await page.getByRole("button", { name: "Withdraw departure request" }).waitFor();
      const path = sql(`select current_membership_path_status from public.members where id='${account.memberId}';`); assert.equal(path, "departure_requested");
      await page.getByRole("button", { name: "Withdraw departure request" }).click();
      await page.getByRole("button", { name: "Request renewal" }).waitFor();
      assert.equal(sql(`select current_membership_path_status from public.members where id='${account.memberId}';`), "open");
    }
    assert.deepEqual(errors, [], `${account.state} browser runtime errors`);
    await context.close();
  }
  console.log(JSON.stringify({ authenticatedLifecycleCombinations: combinations, directFormerEditAndMutation: "passed", realDepartureWithdrawal: "passed", ordinaryMemberConfirmationDenied: "passed", captcha: "remained enabled; preauthenticated synthetic sessions used", environment: "disposable local Auth/Postgres + real Next.js" }));
} catch (error) {
  console.error(`QA failed: ${error.message}`);
  console.error(diagnostics.replace(/eyJ[A-Za-z0-9._-]+/g, "[local token redacted]"));
  process.exitCode = 1;
} finally { await browser.close(); server.kill(); }

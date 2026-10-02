// Real concurrent connections against an explicitly disposable replay database.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const container = process.argv[2];
if (process.env.SCRATCH_ACK !== "DISPOSABLE_SCRATCH" || !/^supabase_db_replay\.[A-Za-z0-9]+$/.test(container ?? "")) {
  throw new Error("Only an acknowledged bootstrap-replay container is accepted.");
}
function sql(query) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1"], { windowsHide: true });
    let output = ""; let error = "";
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { error += chunk; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(`Disposable SQL failed: ${error}`)));
    child.stdin.end(query);
  });
}
const fixtureUser = "00000000-0000-4000-8000-00000000a102";
try {
  const raw = await sql(`
    begin;
    insert into auth.users(id,email,email_confirmed_at,created_at,updated_at)
      values('${fixtureUser}','verification-concurrency@local.invalid',now(),now(),now());
    insert into public.rbac_user_platform_roles(user_id,role_id,scope,note)
      select '${fixtureUser}',id,'admin','Disposable concurrent proof fixture' from public.rbac_platform_roles where scope='admin' and code='admin';
    insert into public.admin_profiles(user_id,admin_code,display_name,is_active,status)
      values('${fixtureUser}','JNUITS-ADMIN-CONCURRENCY-QA','Fictional concurrent verifier',true,'active');
    insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
      values('00000000-0000-4000-8000-00000000a103','${fixtureUser}','totp','verified',now(),now());
    insert into auth.sessions(id,user_id,aal,factor_id,created_at,updated_at)
      values('00000000-0000-4000-8000-00000000a104','${fixtureUser}','aal2','00000000-0000-4000-8000-00000000a103',now(),now());
    select public.admin_verification_context(jsonb_build_object('userId','${fixtureUser}','sessionId','00000000-0000-4000-8000-00000000a104',
      'roleVersion',(select version from public.rbac_user_claim_versions where user_id='${fixtureUser}'),'currentLevel','aal2'));
    commit;
  `);
  const actorResult = JSON.parse(raw);
  assert.equal(actorResult.ok, true);
  const actor = actorResult.value;
  const intent = { operation: "admin.role.change", payload: { adminProfileId: fixtureUser, confirmation: "fixture", roleCode: "admin" } };
  const binding = { actor, intent };
  const prepared = JSON.parse(await sql(`select public.admin_verification_prepare('${JSON.stringify(binding)}'::jsonb);`));
  assert.equal(prepared.ok, true);
  const input = { prepared: prepared.value, ipHash: "b".repeat(64) };
  assert.equal(JSON.parse(await sql(`select public.admin_verification_reserve_password_attempt('${JSON.stringify(input)}'::jsonb);`)).ok, true);
  const proof = JSON.parse(await sql(`select public.admin_verification_issue_password('${JSON.stringify({ prepared: prepared.value, tokenHash: "c".repeat(64) })}'::jsonb);`));
  assert.equal(proof.ok, true);
  const reservation = JSON.stringify({ ...binding, proofId: proof.value.proofId, tokenHash: "c".repeat(64) });
  // Both transactions start independently. Holding the winning lock briefly
  // makes the second connection exercise the wait/recheck rather than a mock.
  const outcomes = await Promise.all([0, 1].map(() => sql(`begin; select (public.admin_verification_reserve('${reservation}'::jsonb)->>'ok')::boolean; select pg_sleep(0.2); commit;`)));
  assert.deepEqual(outcomes.map(value => value.trim()).sort(), ["f", "t"]);
  assert.equal(await sql(`select count(*) from private.admin_verification_attempts a join private.admin_verification_intents i on i.id=a.intent_id where i.user_id='${fixtureUser}';`), "1");
  console.log("Concurrent proof reservation: exactly one winner; one attempt; replay denied.");
} finally {
  // The existing factor audit trigger references its owning Auth user. Remove
  // this fixture's factor first, while that exact fictional user still exists.
  await sql(`begin;
    delete from auth.mfa_factors where user_id='${fixtureUser}' and exists(select 1 from auth.users where id='${fixtureUser}' and email='verification-concurrency@local.invalid');
    delete from public.rbac_user_platform_roles where user_id='${fixtureUser}' and exists(select 1 from auth.users where id='${fixtureUser}' and email='verification-concurrency@local.invalid');
    delete from auth.users where id='${fixtureUser}' and email='verification-concurrency@local.invalid';
    commit;`);
}

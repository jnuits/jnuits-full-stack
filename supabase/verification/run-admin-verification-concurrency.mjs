// Real concurrent connections against an explicitly disposable replay database.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

const container = process.argv[2];
if (process.env.SCRATCH_ACK !== "DISPOSABLE_SCRATCH" || !/^supabase_db_replay\.[A-Za-z0-9]+$/.test(container ?? "")) {
  throw new Error("Only an acknowledged bootstrap-replay container is accepted.");
}

// Two independent, real TOTP sessions attempt permitted cross-removal/freeze.
// Equal-rank demotion is intentionally not a capability we introduce here.
const administrators = [
  { user: "00000000-0000-4000-8000-00000000a202", session: "00000000-0000-4000-8000-00000000a204", factor: "00000000-0000-4000-8000-00000000a206", profile: "00000000-0000-4000-8000-00000000a208", code: "JNUITS-ADMIN-CONCURRENT-A" },
  { user: "00000000-0000-4000-8000-00000000a203", session: "00000000-0000-4000-8000-00000000a205", factor: "00000000-0000-4000-8000-00000000a207", profile: "00000000-0000-4000-8000-00000000a209", code: "JNUITS-ADMIN-CONCURRENT-B" },
];
async function loadActor(admin) {
  const result = JSON.parse(await sql(`select public.admin_verification_context(jsonb_build_object('userId','${admin.user}',
    'sessionId','${admin.session}','roleVersion',(select version from public.rbac_user_claim_versions where user_id='${admin.user}'),'currentLevel','aal2'));`));
  assert.equal(result.ok, true);
  return result.value;
}
async function issueRoleProof(actor, intent) {
  const prepared = JSON.parse(await sql(`select public.admin_verification_prepare('${JSON.stringify({ actor, intent })}'::jsonb);`));
  assert.equal(prepared.ok, true);
  assert.equal(JSON.parse(await sql(`select public.admin_verification_reserve_password_attempt('${JSON.stringify({ prepared: prepared.value, ipHash: "e".repeat(64) })}'::jsonb);`)).ok, true);
  const token = "p".repeat(43);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const result = JSON.parse(await sql(`select public.admin_verification_issue_password('${JSON.stringify({ prepared: prepared.value, tokenHash })}'::jsonb);`));
  assert.equal(result.ok, true);
  return `${result.value.proofId}.${token}`;
}
try {
  await sql(`begin; ${administrators.map(admin => `
    insert into auth.users(id,email,email_confirmed_at,created_at,updated_at) values('${admin.user}','${admin.code.toLowerCase()}@local.invalid',now(),now(),now());
    insert into public.rbac_user_platform_roles(user_id,role_id,scope,note) select '${admin.user}',id,'admin','Disposable last-super-admin concurrency fixture' from public.rbac_platform_roles where scope='admin' and code='super_admin';
    insert into public.admin_profiles(id,user_id,admin_code,display_name,is_active,status) values('${admin.profile}','${admin.user}','${admin.code}','Fictional concurrent super admin',true,'active');
    insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) values('${admin.factor}','${admin.user}','totp','verified',now(),now());
    insert into auth.sessions(id,user_id,aal,factor_id,created_at,updated_at) values('${admin.session}','${admin.user}','aal2','${admin.factor}',now(),now());`).join("\n")} commit;`);
  assert.equal(await sql("select count(*) from public.admin_profiles where status='active' and is_active and private.admin_role_rank(user_id)=3;"), "2");
  const actors = await Promise.all(administrators.map(loadActor));
  // The preserved capability denies changing another super admin's role even
  // with valid dual proof. No hidden demotion path is added for this test.
  const demotion = { operation: "admin.role.change", payload: { adminProfileId: administrators[1].profile, confirmation: administrators[1].code, roleCode: "admin" } };
  const demotionProof = await issueRoleProof(actors[0], demotion);
  assert.equal(await sql(`begin;
    select set_config('request.jwt.claim.sub','${actors[0].userId}',true) is not null;
    select set_config('request.jwt.claims','${JSON.stringify({ sub: actors[0].userId, role: "authenticated", aal: "aal2", session_id: actors[0].sessionId, jnuits_role_version: actors[0].roleVersion })}',true) is not null;
    create function pg_temp.try_change() returns boolean language plpgsql as $q$ begin
      perform public.apply_admin_role_operation('admin.role.change','${JSON.stringify(demotion.payload)}'::jsonb,'${demotionProof}'); return true;
      exception when insufficient_privilege then return false; end; $q$;
    grant execute on function pg_temp.try_change() to authenticated;
    set local role authenticated; select pg_temp.try_change(); commit;`), "t\nt\nf");
  const removals = administrators.map((_, index) => ({ operation: "admin.role.remove", payload: { adminProfileId: administrators[1-index].profile, confirmation: administrators[1-index].code } }));
  const proofs = await Promise.all(actors.map((actor,index) => issueRoleProof(actor, removals[index])));
  const outcomes = await Promise.all(actors.map((actor,index) => sql(`begin;
    do $q$ begin perform set_config('request.jwt.claim.sub','${actor.userId}',true);
      perform set_config('request.jwt.claims','${JSON.stringify({ sub: actor.userId, role: "authenticated", aal: "aal2", session_id: actor.sessionId, jnuits_role_version: actor.roleVersion })}',true); end; $q$;
    create function pg_temp.try_remove() returns boolean language plpgsql as $q$ begin
      perform public.apply_admin_role_operation('admin.role.remove','${JSON.stringify(removals[index].payload)}'::jsonb,'${proofs[index]}'); return true;
      exception when insufficient_privilege then return false; end; $q$;
    grant execute on function pg_temp.try_remove() to authenticated;
    set local role authenticated; select pg_temp.try_remove(); select pg_sleep(0.2); commit;`)));
  assert.deepEqual(outcomes.map(value => value.trim()).sort(), ["f", "t"]);
  assert.equal(await sql("select count(*) from public.admin_profiles where status='active' and is_active and private.admin_role_rank(user_id)=3;"), "1");
  console.log("Concurrent dual-verified cross-removal: one winner; one active super admin remains; equal-rank demotion denied.");

  await sql(`begin; ${administrators.map(admin => `
    update public.admin_profiles set status='active',is_active=true where id='${admin.profile}';
    insert into public.rbac_user_platform_roles(user_id,role_id,scope,note) select '${admin.user}',id,'admin','Reset exact disposable concurrency fixture' from public.rbac_platform_roles where scope='admin' and code='super_admin' on conflict do nothing;`).join("\n")} commit;`);
  const freezeActors = await Promise.all(administrators.map(loadActor));
  const freezeIntents = administrators.map((_,index) => ({ operation: "admin.lifecycle.freeze", payload: { adminProfileId: administrators[1-index].profile, confirmation: administrators[1-index].code } }));
  const freezes = await Promise.all(freezeActors.map((actor,index) => sql(`begin;
    select (public.admin_verification_reserve('${JSON.stringify({ actor, intent: freezeIntents[index] })}'::jsonb)->>'ok')::boolean;
    select pg_sleep(0.2); commit;`)));
  assert.deepEqual(freezes.map(value => value.trim()).sort(), ["f", "t"]);
  const pending = JSON.parse(await sql(`select jsonb_build_object('attemptId',a.id,'payload',i.payload) from private.admin_verification_attempts a
    join private.admin_verification_intents i on i.id=a.intent_id where a.status='reserved' and i.operation='admin.lifecycle.freeze'
      and i.user_id in ('${administrators[0].user}','${administrators[1].user}');`));
  await sql(`update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id=(select user_id from public.admin_profiles where id='${pending.payload.adminProfileId}');`);
  assert.equal(JSON.parse(await sql(`select public.complete_admin_lifecycle_operation('${pending.attemptId}','${JSON.stringify(pending.payload)}'::jsonb);`)).ok, true);
  assert.equal(await sql("select count(*) from public.admin_profiles where status='active' and is_active and private.admin_role_rank(user_id)=3;"), "1");
  console.log("Concurrent cross-freeze: one reservation; target blocked before Auth side effect; one active super admin remains.");
} finally {
  const ids = administrators.map(admin => `'${admin.user}'`).join(",");
  // Exact fictional identities only, in the existing trigger-safe cleanup order.
  await sql(`begin;
    delete from auth.mfa_factors where user_id in (${ids});
    delete from public.rbac_user_platform_roles where user_id in (${ids});
    delete from auth.users where id in (${ids}) and email like 'jnuits-admin-concurrent-%@local.invalid';
    commit;`);
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

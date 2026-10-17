// Test child only; never imported by the application or enabled by a product
// flag. Capture the developed Resend HTTP boundary without real mail delivery.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Node's synchronous --require preload starts before Next and its workers.
const assert = require("node:assert/strict");
assert.equal(process.env.ADMIN_VERIFICATION_QA, "DISPOSABLE_SCRATCH");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:55761");
assert.equal(process.env.APP_BASE_URL, "http://127.0.0.1:3127");
assert.match(process.env.ADMIN_VERIFICATION_QA_BRIDGE || "", /^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(process.env.ADMIN_VERIFICATION_QA_TOKEN);
// Same test-only process boundary: hosted Supabase is permitted by production
// CSP, whereas this disposable local Auth origin is not. Keep the native HTML
// stream and all directives; supplement only connect-src at the header layer.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Node synchronous test preload.
const { ServerResponse } = require("node:http");
const nativeSetHeader = ServerResponse.prototype.setHeader;
ServerResponse.prototype.setHeader = function fixtureSetHeader(name, value) {
  if (String(name).toLowerCase() === "content-security-policy" && typeof value === "string") {
    value = value.split(";").map(directive => directive.trim().startsWith("connect-src ") ? `${directive} http://127.0.0.1:55761` : directive).join(";");
  }
  return nativeSetHeader.call(this, name, value);
};
const nativeFetch = globalThis.fetch;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Node synchronous test preload.
const {classifyFixtureResendRequest} = require("./admin-notification-qa-policy.cjs");
globalThis.fetch = async function fixtureFetch(input, init) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const fixture = classifyFixtureResendRequest(url, init);
  if (!fixture) return nativeFetch(input, init);
  if (fixture.kind === "suppression") {
    const response = await nativeFetch(`${process.env.ADMIN_VERIFICATION_QA_BRIDGE}/notice_suppression`, {
      method:"POST",headers:{Authorization:`Bearer ${process.env.ADMIN_VERIFICATION_QA_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({to:fixture.to}),
    });
    if (!response.ok) throw new Error("Disposable suppression bridge unavailable.");
    const state = await response.json();
    return state.blocked ? Response.json({object:"suppression"}) : new Response(null,{status:404});
  }
  const body = JSON.parse(init?.body || "{}");
  if (!Array.isArray(body.to) || body.to.length !== 1 || !/^qa-[a-z]+-[a-f0-9]+@local\.invalid$/.test(body.to[0])) {
    throw new Error("Refusing mail outside disposable fixture identities.");
  }
  const idempotencyKey = new Headers(init?.headers).get("Idempotency-Key") || "";
  const notice = idempotencyKey.startsWith("jnuits-admin/");
  return nativeFetch(`${process.env.ADMIN_VERIFICATION_QA_BRIDGE}/${notice ? "notice_transport" : "transport"}`, {
    method: "POST", headers: { Authorization: `Bearer ${process.env.ADMIN_VERIFICATION_QA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to: body.to[0], html: body.html, ...(notice ? {text:body.text,subject:body.subject,from:body.from,replyTo:body.reply_to,idempotencyKey} : {}) }),
  });
};

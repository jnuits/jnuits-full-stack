// eslint-disable-next-line @typescript-eslint/no-require-imports -- Shared with the synchronous Node --require fixture preload.
const assert = require("node:assert/strict");
const fixtureAddress = /^qa-[a-z]+-[a-f0-9]+@local\.invalid$/;
exports.classifyFixtureResendRequest = function classifyFixtureResendRequest(url, init = {}) {
  const target = new URL(url);
  if (target.origin !== "https://api.resend.com") return null;
  if (target.pathname.startsWith("/suppressions/") && (init.method || "GET") === "GET") {
    const to = decodeURIComponent(target.pathname.slice("/suppressions/".length));
    assert.match(to, fixtureAddress, "Refusing suppression lookup outside disposable identities.");
    return {kind:"suppression",to};
  }
  assert.equal(target.pathname, "/emails", "Refusing provider endpoint outside disposable mail.");
  assert.equal(init.method, "POST");
  const body = JSON.parse(init.body || "{}");
  assert.ok(Array.isArray(body.to) && body.to.length === 1 && fixtureAddress.test(body.to[0]), "Refusing mail outside disposable identities.");
  return {kind:"send",to:body.to[0]};
};

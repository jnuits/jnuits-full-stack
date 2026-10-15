import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { once } from "node:events";
import { checkSupabaseAuthURLs } from "./check-supabase-auth-urls.mjs";

const env = { SUPABASE_PROJECT_REF: "fsirdkjgrcocowxqjhjg", SUPABASE_ACCESS_TOKEN: "fixture-token-only" };
const servers = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve)))); });
async function provider(body, status = 200) {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ method: req.method, path: req.url, authorization: req.headers.authorization });
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  });
  servers.push(server); server.listen(0, "127.0.0.1"); await once(server, "listening");
  return { requests, fetchImpl: (url, init) => {
    expect(url).toBe(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/config/auth`);
    expect(init.redirect).toBe("error");
    return fetch(`http://127.0.0.1:${server.address().port}/config/auth`, init);
  } };
}
describe("read-only hosted Auth URL drift check", () => {
  it("reads the protected provider once and accepts the canonical URL with scoped redirects", async () => {
    const fixture = await provider({ site_url: "https://jnuits.org.bd/", uri_allow_list: "https://jnuits.org.bd/**,https://jnuits-*-full-stack-jnuitsbd.vercel.app/**", smtp_pass: "must-never-appear" });
    const result = await checkSupabaseAuthURLs(env, fixture);
    expect(result).toEqual({ ok: true, siteURLCanonical: true, canonicalRedirectPresent: true });
    expect(fixture.requests).toEqual([{ method: "GET", path: "/config/auth", authorization: "Bearer fixture-token-only" }]);
    expect(JSON.stringify(result)).not.toContain("must-never-appear");
  });
  it("detects the reported Vercel overwrite without exposing the provider configuration", async () => {
    const fixture = await provider({ site_url: "https://jnuits-full-stack-jnuitsbd.vercel.app/", uri_allow_list: "https://jnuits-full-stack-jnuitsbd.vercel.app/**", smtp_pass: "secret" });
    expect(await checkSupabaseAuthURLs(env, fixture)).toEqual({ ok: false, siteURLCanonical: false, canonicalRedirectPresent: false });
  });
  it.each(["https://jnuits.org.bd.attacker.test/**", "http://jnuits.org.bd/**", "https://jnuits.org.bd/", "https://jnuits.org.bd/**?token=secret"])("rejects an insufficient or different redirect policy: %s", async redirect => {
    const fixture = await provider({ site_url: "https://jnuits.org.bd", uri_allow_list: redirect });
    expect(await checkSupabaseAuthURLs(env, fixture)).toMatchObject({ ok: false, canonicalRedirectPresent: false });
  });
  it.each([401, 403, 429, 500])("fails closed for provider status %s without logging its body", async status => {
    const fixture = await provider({ message: "fixture-token-only secret configuration" }, status);
    expect(await checkSupabaseAuthURLs(env, fixture)).toEqual({ ok: false, error: "provider_unavailable", status });
  });
  it("fails closed on malformed data or a network error without exposing error text", async () => {
    const fixture = await provider({ site_url: "https://jnuits.org.bd", uri_allow_list: null });
    expect(await checkSupabaseAuthURLs(env, fixture)).toEqual({ ok: false, error: "invalid_provider_response" });
    expect(await checkSupabaseAuthURLs(env, { fetchImpl: async () => { throw new Error("fixture-token-only"); } })).toEqual({ ok: false, error: "provider_unavailable" });
  });
  it("refuses missing credentials and invalid project refs before any request", async () => {
    for (const invalid of [{}, { ...env, SUPABASE_ACCESS_TOKEN: "" }, { ...env, SUPABASE_PROJECT_REF: "../../other" }]) {
      expect(await checkSupabaseAuthURLs(invalid, { fetchImpl: () => { throw new Error("must not fetch"); } })).toEqual({ ok: false, error: "configuration_missing" });
    }
  });
});

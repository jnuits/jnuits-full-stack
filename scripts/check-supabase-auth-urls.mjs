import { pathToFileURL } from "node:url";

/** Metadata-only check. Never print the Auth config: it can contain SMTP secrets. */
export async function checkSupabaseAuthURLs(env, { fetchImpl = fetch } = {}) {
  const ref = env.SUPABASE_PROJECT_REF;
  const token = env.SUPABASE_ACCESS_TOKEN;
  if (!/^[a-z0-9]{20}$/.test(ref ?? "") || !token?.trim()) return { ok: false, error: "configuration_missing" };
  try {
    const response = await fetchImpl(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
      method: "GET", headers: { Authorization: `Bearer ${token}` },
      redirect: "error", signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { ok: false, error: "provider_unavailable", status: response.status };
    const config = await response.json();
    if (typeof config?.site_url !== "string" || typeof config?.uri_allow_list !== "string") return { ok: false, error: "invalid_provider_response" };
    const siteURLCanonical = ["https://jnuits.org.bd", "https://jnuits.org.bd/"].includes(config.site_url);
    // Check the chosen policy exactly; do not approximate Supabase's glob rules.
    const canonicalRedirectPresent = config.uri_allow_list.split(",").some(value => value.trim() === "https://jnuits.org.bd/**");
    return { ok: siteURLCanonical && canonicalRedirectPresent, siteURLCanonical, canonicalRedirectPresent };
  } catch {
    return { ok: false, error: "provider_unavailable" };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await checkSupabaseAuthURLs(process.env);
  console.log(JSON.stringify({ check: "supabase-auth-urls", ...result }));
  if (!result.ok) process.exitCode = 1;
}

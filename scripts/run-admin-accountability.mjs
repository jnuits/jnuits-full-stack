import { pathToFileURL } from "node:url";

/** Explicit operator run; previews never send mail. Apply uses the enabled job policy. */
export async function runAccountabilityOperator(args, env, { fetchImpl = fetch } = {}) {
  if (args.some(arg => arg !== "--apply") || args.length > 1 || !["https://jnuits.org.bd", "https://jnuits.org.bd/"].includes(env.APP_BASE_URL) || !env.CRON_SECRET?.trim()) return { ok: false, error: "configuration_invalid" };
  const dryRun = args.length === 0;
  try {
    const response = await fetchImpl("https://jnuits.org.bd/api/cron/admin-accountability" + (dryRun ? "?dryRun=1" : ""), {
      method: "GET", headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      redirect: "error", signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) return { ok: false, error: "collection_unavailable" };
    const result = await response.json();
    if (![result?.read, result?.imported].every(value => Number.isInteger(value) && value >= 0 && value <= 500) || result.imported > result.read || typeof result.backlog !== "boolean" || !["current", "delayed", "partial", "unavailable"].includes(result.coverage) || !Array.isArray(result.errors) || result.errors.length) return { ok: false, error: "collection_unavailable" };
    const optionalCounters = {};
    for (const [key, maximum] of [["notices", Number.MAX_SAFE_INTEGER], ["sends", 10], ["digests", 100]]) {
      if (result[key] === undefined) continue; // Older collection-only deployment.
      if (!Number.isSafeInteger(result[key]) || result[key] < 0 || result[key] > maximum) return { ok: false, error: "collection_unavailable" };
      optionalCounters[key] = result[key];
    }
    return { ok: true, dryRun, imported: result.imported, read: result.read, backlog: result.backlog, coverage: result.coverage, errors: [], ...optionalCounters };
  } catch { return { ok: false, error: "collection_unavailable" }; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await import("dotenv/config");
  const result = await runAccountabilityOperator(process.argv.slice(2), process.env);
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}

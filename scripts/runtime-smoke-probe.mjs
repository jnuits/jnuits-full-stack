const baseUrl = (process.env.RUNTIME_PROBE_BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const vercelAutomationBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();

const probes = [
  { maxMs: 5000, path: "/", statuses: [200] },
  { maxMs: 5000, path: "/members", statuses: [200] },
  { maxMs: 7000, path: "/gallery", statuses: [200] },
  { maxMs: 7000, path: "/events", statuses: [200] },
  { maxMs: 5000, path: "/api/members?pageSize=1", statuses: [200] },
];

const failures = [];

for (const probe of probes) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), probe.maxMs + 1500);

  try {
    const response = await fetch(`${baseUrl}${probe.path}`, {
      headers: {
        accept: "text/html,application/json",
        ...(vercelAutomationBypassSecret
          ? { "x-vercel-protection-bypass": vercelAutomationBypassSecret }
          : {}),
      },
      signal: controller.signal,
    });
    const elapsed = Math.round(performance.now() - started);
    const ok = probe.statuses.includes(response.status) && elapsed <= probe.maxMs;
    console.log(`${ok ? "PASS" : "FAIL"} ${response.status} ${elapsed}ms ${probe.path}`);

    if (!ok) {
      failures.push(`${probe.path} returned ${response.status} in ${elapsed}ms; expected ${probe.statuses.join("/")} within ${probe.maxMs}ms.`);
    }
  } catch (error) {
    failures.push(`${probe.path} failed: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`FAIL ERR ${probe.path}`);
  } finally {
    clearTimeout(timeout);
  }
}

if (failures.length > 0) {
  console.error("\nRuntime smoke probe failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("\nRuntime smoke probe passed.");
}

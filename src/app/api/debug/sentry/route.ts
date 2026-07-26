import * as Sentry from "@sentry/nextjs";

/**
 * Manual Sentry verification endpoint.
 *
 * Denied on every deployed environment. NODE_ENV alone is the wrong signal: it
 * describes the build, not where it runs, so a preview or development
 * deployment could otherwise expose an endpoint that mints Sentry events on
 * demand. VERCEL_ENV is present on all Vercel deployments regardless of target,
 * and the NODE_ENV check still covers self-hosted production.
 */
function diagnosticsDenied() {
  return Boolean(process.env.VERCEL_ENV?.trim()) || process.env.NODE_ENV === "production";
}

export async function GET() {
  if (diagnosticsDenied()) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const eventId = Sentry.captureException(
    new Error("Manual Sentry verification event from /api/debug/sentry")
  );

  await Sentry.flush(2_000);

  return Response.json({
    ok: true,
    eventId,
  });
}

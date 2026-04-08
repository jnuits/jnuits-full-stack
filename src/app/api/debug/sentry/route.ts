import * as Sentry from "@sentry/nextjs";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
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

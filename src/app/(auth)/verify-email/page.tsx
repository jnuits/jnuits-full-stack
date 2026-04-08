export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const error =
    typeof resolvedSearchParams.error === "string"
      ? resolvedSearchParams.error
      : null;
  const message =
    typeof resolvedSearchParams.message === "string"
      ? resolvedSearchParams.message
      : "Check your inbox for the verification or recovery link.";

  return (
    <div>
      <span className="eyebrow">Email confirmation</span>
      <h1 className="section-title mt-4 text-[2.4rem]">Verify your email address.</h1>
      <p className="section-copy mt-3">
        Supabase confirmation and recovery links now return through
        `/auth/confirm`, so users stay inside the unified app.
      </p>
      <div className="glass-card mt-8 grid gap-4 p-5">
        <p className="status-pill">{message}</p>
        {error ? (
          <p className="text-sm font-semibold text-[var(--brand-rust)]">{error}</p>
        ) : null}
        <p className="text-sm font-semibold text-[var(--brand-ink)]">
          Update the Supabase email templates so confirmation and recovery links
          point to `/auth/confirm?token_hash=...&type=email`.
        </p>
      </div>
    </div>
  );
}

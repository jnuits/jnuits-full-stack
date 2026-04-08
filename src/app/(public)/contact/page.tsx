export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const message =
    typeof resolvedSearchParams.message === "string"
      ? resolvedSearchParams.message
      : null;
  const error =
    typeof resolvedSearchParams.error === "string"
      ? resolvedSearchParams.error
      : null;

  return (
    <div className="shell py-12">
      <div className="glass-card grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="eyebrow">Contact</span>
          <h1 className="section-title mt-4">Reach the JnUITS team without routing through the legacy proxy.</h1>
          <p className="section-copy mt-4">
            This form posts directly to the new `POST /api/contact/submit` route.
            Delivery is phase-gated on Resend environment variables, but the input
            validation, honeypot, and request surface are already scaffolded.
          </p>
          {message ? <p className="status-pill mt-6">{message}</p> : null}
          {error ? (
            <p className="mt-4 text-sm font-semibold text-[var(--brand-rust)]">{error}</p>
          ) : null}
          <form action="/api/contact/submit" method="post" className="mt-8 grid gap-4">
            <input name="name" placeholder="Your name" required />
            <input name="email" type="email" placeholder="Email address" required />
            <input name="subject" placeholder="Subject" required />
            <textarea name="message" rows={7} placeholder="How can we help?" required />
            <div style={{ display: "none" }}>
              <input name="website" tabIndex={-1} autoComplete="off" />
            </div>
            <button className="primary-button w-full sm:w-fit" type="submit">
              Send message
            </button>
          </form>
        </div>

        <div className="route-grid content-start">
          <article className="route-tile">
            <h3>Email delivery</h3>
            <p>Uses Resend once `RESEND_API_KEY` and sender variables are configured.</p>
          </article>
          <article className="route-tile">
            <h3>Bot protection</h3>
            <p>Honeypot field stays in place to silently absorb low-effort spam.</p>
          </article>
          <article className="route-tile">
            <h3>Safe rollout</h3>
            <p>Public route exists now, but delivery can stay disabled until secrets are set.</p>
          </article>
        </div>
      </div>
    </div>
  );
}

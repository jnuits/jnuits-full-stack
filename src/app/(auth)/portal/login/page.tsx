import Link from "next/link";
import { loginPortal } from "@/app/(auth)/actions";
import { TurnstileField } from "@/components/auth/turnstile-field";
import { resolveScopedNextPath } from "@/lib/auth/session";
import { getTurnstileSiteKey } from "@/lib/security/captcha";

export default async function PortalLoginPage({
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
      : null;
  const next = resolveScopedNextPath(
    typeof resolvedSearchParams.next === "string"
      ? resolvedSearchParams.next
      : null,
    ["/portal", "/profile"],
    "/portal/dashboard"
  );
  const turnstileSiteKey = getTurnstileSiteKey();

  return (
    <div>
      <span className="eyebrow">Member access</span>
      <h1 className="section-title mt-4 text-[2.25rem]">
        Sign in to your member portal.
      </h1>
      <p className="section-copy mt-3">
        Access your JnUITS profile, activity, projects, and community tools
        with your registered account.
      </p>
      {message ? <p className="status-pill mt-6">{message}</p> : null}
      {error ? (
        <p className="mt-4 text-sm font-semibold text-[var(--brand-rust)]">
          {error}
        </p>
      ) : null}
      <form className="mt-8 grid gap-4">
        <label className="input-label" htmlFor="portal-login-email">
          Email address
          <input
            id="portal-login-email"
            autoComplete="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
          />
        </label>
        <label className="input-label" htmlFor="portal-login-password">
          Password
          <input
            id="portal-login-password"
            autoComplete="current-password"
            name="password"
            type="password"
            placeholder="Your password"
            required
          />
        </label>
        <TurnstileField siteKey={turnstileSiteKey} />
        <input type="hidden" name="next" value={next} />
        <button className="primary-button" formAction={loginPortal}>
          Sign in to portal
        </button>
      </form>
      <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
        <Link className="queue-link" href="/forgot-password">
          Forgot password?
        </Link>
        <Link className="queue-link" href="/register">
          Need to claim your member profile?
        </Link>
      </div>
    </div>
  );
}

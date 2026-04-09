import { login } from "@/app/(auth)/actions";
import { resolveSafeNextPath } from "@/lib/auth/session";

export default async function LoginPage({
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
  const next = resolveSafeNextPath(
    typeof resolvedSearchParams.next === "string"
      ? resolvedSearchParams.next
      : null,
    "/portal"
  );

  return (
    <div>
      <span className="eyebrow">Member sign in</span>
      <h1 className="section-title mt-4 text-[2.4rem]">Sign in to your JnUITS account.</h1>
      <p className="section-copy mt-3">
        Access your member portal, profile, and activity history. Use the
        email and password you registered with.
      </p>
      {message ? <p className="status-pill mt-6">{message}</p> : null}
      {error ? (
        <p className="mt-4 text-sm font-semibold text-[var(--brand-rust)]">{error}</p>
      ) : null}
      <form className="mt-8 grid gap-4">
        <label className="input-label" htmlFor="login-email">
          Email address
          <input
            id="login-email"
            autoComplete="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
          />
        </label>
        <label className="input-label" htmlFor="login-password">
          Password
          <input
            id="login-password"
            autoComplete="current-password"
            name="password"
            type="password"
            placeholder="Your password"
            required
          />
        </label>
        <input type="hidden" name="next" value={next} />
        <button className="primary-button" formAction={login}>
          Sign in
        </button>
      </form>
    </div>
  );

}

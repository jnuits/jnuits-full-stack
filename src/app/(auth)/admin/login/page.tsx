import Link from "next/link";
import { loginAdmin } from "@/app/(auth)/actions";
import { resolveScopedNextPath } from "@/lib/auth/session";

export default async function AdminLoginPage({
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
    ["/admin"],
    "/admin/dashboard"
  );

  return (
    <div>
      <span className="eyebrow">Operator access</span>
      <h1 className="section-title mt-4 text-[2.25rem]">
        Sign in to the admin portal.
      </h1>
      <p className="section-copy mt-3">
        Authorized JnUITS operators can access moderation queues, CMS tools,
        and platform controls here.
      </p>
      {message ? <p className="status-pill mt-6">{message}</p> : null}
      {error ? (
        <p className="mt-4 text-sm font-semibold text-[var(--brand-rust)]">
          {error}
        </p>
      ) : null}
      <form className="mt-8 grid gap-4">
        <label className="input-label" htmlFor="admin-login-email">
          Email address
          <input
            id="admin-login-email"
            autoComplete="email"
            name="email"
            type="email"
            placeholder="operator@jnuits.org"
            required
          />
        </label>
        <label className="input-label" htmlFor="admin-login-password">
          Password
          <input
            id="admin-login-password"
            autoComplete="current-password"
            name="password"
            type="password"
            placeholder="Your password"
            required
          />
        </label>
        <input type="hidden" name="next" value={next} />
        <button className="primary-button" formAction={loginAdmin}>
          Sign in to admin
        </button>
      </form>
      <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
        <Link className="queue-link" href="/forgot-password">
          Forgot password?
        </Link>
        <Link className="queue-link" href="/portal/login">
          Need member access instead?
        </Link>
      </div>
    </div>
  );
}

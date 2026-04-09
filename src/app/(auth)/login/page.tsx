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
      <span className="eyebrow">Authentication</span>
      <h1 className="section-title mt-4 text-[2.4rem]">Sign in with Supabase Auth.</h1>
      <p className="section-copy mt-3">
        This route now posts into a server action backed by Supabase SSR cookies,
        so preview and production builds use the same session flow.
      </p>
      {message ? <p className="status-pill mt-6">{message}</p> : null}
      {error ? (
        <p className="mt-4 text-sm font-semibold text-[var(--brand-rust)]">{error}</p>
      ) : null}
      <form className="mt-8 grid gap-4">
        <input
          autoComplete="email"
          name="email"
          type="email"
          placeholder="Email address"
          required
        />
        <input
          autoComplete="current-password"
          name="password"
          type="password"
          placeholder="Password"
          required
        />
        <input type="hidden" name="next" value={next} />
        <button className="primary-button" formAction={login}>
          Sign in
        </button>
      </form>
    </div>
  );
}

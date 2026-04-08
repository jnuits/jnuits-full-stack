import { requestPasswordReset } from "@/app/(auth)/actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const error =
    typeof resolvedSearchParams.error === "string"
      ? resolvedSearchParams.error
      : null;

  return (
    <div>
      <span className="eyebrow">Recovery</span>
      <h1 className="section-title mt-4 text-[2.4rem]">Forgot password</h1>
      <p className="section-copy mt-3">
        Password recovery now uses Supabase Auth directly and returns users to the
        unified app through the SSR confirmation route.
      </p>
      {error ? (
        <p className="mt-4 text-sm font-semibold text-[var(--brand-rust)]">{error}</p>
      ) : null}
      <form className="mt-8 grid gap-4">
        <input name="email" type="email" placeholder="Email address" required />
        <button className="primary-button" formAction={requestPasswordReset}>
          Send recovery link
        </button>
      </form>
    </div>
  );
}

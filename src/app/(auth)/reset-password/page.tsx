import { updatePassword } from "@/app/(auth)/actions";
import { PasswordSecurityField } from "@/components/auth/password-security-field";

export default async function ResetPasswordPage({
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
      <h1 className="section-title mt-4 text-[2.4rem]">Reset password</h1>
      <p className="section-copy mt-3">
        This route updates the current Supabase user after the recovery or
        reauthentication link lands back in the app.
      </p>
      {error ? (
        <p className="mt-4 text-sm font-semibold text-[var(--brand-rust)]">{error}</p>
      ) : null}
      <form className="mt-8 grid gap-4">
        <PasswordSecurityField
          id="reset-password"
          name="password"
          placeholder="New 12+ character password"
          required
        />
        <p className="text-xs leading-5 text-[var(--muted-foreground)]">Use a long, unique passphrase. Common, predictable, and breached passwords are rejected.</p>
        <input
          autoComplete="new-password"
          name="confirmPassword"
          type="password"
          placeholder="Confirm new password"
          required
        />
        <button className="primary-button" formAction={updatePassword}>
          Update password
        </button>
      </form>
    </div>
  );
}

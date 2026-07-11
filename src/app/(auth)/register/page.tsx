import { claimProfile } from "@/app/(auth)/actions";
import { TurnstileField } from "@/components/auth/turnstile-field";
import { getAuthCaptchaUiConfig } from "@/lib/security/captcha";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const error =
    typeof resolvedSearchParams.error === "string"
      ? resolvedSearchParams.error
      : null;
  const captcha = getAuthCaptchaUiConfig();

  return (
    <div>
      <span className="eyebrow">Claim flow</span>
      <h1 className="section-title mt-4 text-[2.4rem]">
        Claim your JnUITS member profile.
      </h1>
      <p className="section-copy mt-3">
        Enter the details from your invitation email, then create the password
        you will use for the member portal.
      </p>
      {error ? (
        <p className="mt-4 text-sm font-semibold text-[var(--brand-rust)]">{error}</p>
      ) : null}
      <form className="mt-8 grid gap-4">
        <input
          autoComplete="off"
          name="jnuitsId"
          placeholder="JnUITS ID"
          required
        />
        <input
          autoComplete="one-time-code"
          name="invitationCode"
          placeholder="Invitation code"
          required
        />
        <input
          autoComplete="email"
          name="email"
          type="email"
          placeholder="Email address"
          required
        />
        <input
          autoComplete="new-password"
          name="password"
          type="password"
          placeholder="Create a 12+ character password"
          required
        />
        <p className="text-xs leading-5 text-[var(--muted-foreground)]">Use a long, unique passphrase. Common passwords and passwords based on your email are rejected.</p>
        {captcha.required ? <TurnstileField siteKey={captcha.siteKey} /> : null}
        <button className="primary-button" formAction={claimProfile}>
          Claim profile
        </button>
      </form>
    </div>
  );
}

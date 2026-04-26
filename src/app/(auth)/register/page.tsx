import { claimProfile } from "@/app/(auth)/actions";
import { TurnstileField } from "@/components/auth/turnstile-field";
import { getTurnstileSiteKey } from "@/lib/security/captcha";

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
  const turnstileSiteKey = getTurnstileSiteKey();

  return (
    <div>
      <span className="eyebrow">Claim flow</span>
      <h1 className="section-title mt-4 text-[2.4rem]">
        Claim your member profile with invitation credentials.
      </h1>
      <p className="section-copy mt-3">
        This route is wired to the new `member_invitations` table so claims stop
        depending on the legacy Strapi user bridge.
      </p>
      {error ? (
        <p className="mt-4 text-sm font-semibold text-[var(--brand-rust)]">{error}</p>
      ) : null}
      <form className="mt-8 grid gap-4">
        <input autoComplete="off" name="jnuitsId" placeholder="JnUITS ID" required />
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
          placeholder="Create password"
          required
        />
        <TurnstileField siteKey={turnstileSiteKey} />
        <button className="primary-button" formAction={claimProfile}>
          Claim profile
        </button>
      </form>
    </div>
  );
}

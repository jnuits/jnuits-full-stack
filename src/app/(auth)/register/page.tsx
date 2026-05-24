import { claimProfile } from "@/app/(auth)/actions";
import { TurnstileField } from "@/components/auth/turnstile-field";
import { normalizeJnuitsIdForCreation } from "@/lib/members/jnuits-id";
import { getTurnstileSiteKey } from "@/lib/security/captcha";

function readParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];
  return typeof value === "string" ? value.trim().slice(0, 180) : "";
}

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
  const prefillJnuitsId =
    normalizeJnuitsIdForCreation(
      readParam(resolvedSearchParams, "jnuitsId") ||
        readParam(resolvedSearchParams, "id")
    ) || "";
  const prefillInvitationCode = (
    readParam(resolvedSearchParams, "code") ||
    readParam(resolvedSearchParams, "invitationCode")
  ).toUpperCase();
  const prefillEmail = readParam(resolvedSearchParams, "email").toLowerCase();
  const turnstileSiteKey = getTurnstileSiteKey();

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
          defaultValue={prefillJnuitsId}
          name="jnuitsId"
          placeholder="JnUITS ID"
          required
        />
        <input
          autoComplete="one-time-code"
          defaultValue={prefillInvitationCode}
          name="invitationCode"
          placeholder="Invitation code"
          required
        />
        <input
          autoComplete="email"
          defaultValue={prefillEmail}
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

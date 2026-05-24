import Link from "next/link";

import { resendSignupConfirmation } from "@/app/(auth)/actions";
import { TurnstileField } from "@/components/auth/turnstile-field";
import { getTurnstileSiteKey } from "@/lib/security/captcha";

export default async function VerifyEmailPage({
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
      : "Account created. Check your email for the confirmation link.";
  const email =
    typeof resolvedSearchParams.email === "string"
      ? resolvedSearchParams.email.trim().toLowerCase()
      : "";
  const hasError = Boolean(error);
  const turnstileSiteKey = getTurnstileSiteKey();

  return (
    <div>
      <span className="eyebrow">
        {hasError ? "Confirmation issue" : "Email confirmation"}
      </span>
      <h1 className="section-title mt-4 text-[2.4rem]">
        {hasError
          ? "We could not verify this link."
          : "Check your email to finish claiming your profile."}
      </h1>
      <p className="section-copy mt-3">
        {hasError
          ? "Confirmation links can expire or be used only once. Request a fresh confirmation email, then open the newest link from your inbox."
          : "Your portal account has been created. Open the confirmation link sent to your email address; after verification, your JnUITS profile will be connected automatically."}
      </p>
      <div className="glass-card mt-8 grid gap-4 p-5">
        <p
          className={
            hasError ? "status-pill status-pill--danger" : "status-pill"
          }
        >
          {error ?? message}
        </p>
        <p className="text-sm font-semibold text-[var(--brand-ink)]">
          {hasError
            ? "If you already requested more than one email, use the newest message. You can also return to the claim form and try again with the same JnUITS ID and email address."
            : "The email can take a minute to arrive. Check your inbox, spam, or promotions folder before requesting another confirmation."}
        </p>
        <form className="grid gap-3" action={resendSignupConfirmation}>
          <label className="input-label" htmlFor="confirmation-email">
            Confirmation email address
            <input
              autoComplete="email"
              defaultValue={email}
              id="confirmation-email"
              name="email"
              placeholder="member@example.com"
              required
              type="email"
            />
          </label>
          <TurnstileField siteKey={turnstileSiteKey} />
          <button className="ghost-button w-full" type="submit">
            Resend confirmation email
          </button>
        </form>
        <div className="flex flex-wrap gap-3">
          <Link className="primary-button w-auto px-5" href="/portal/login">
            Go to portal login
          </Link>
          <Link className="ghost-button w-auto px-5" href="/register">
            Back to claim form
          </Link>
        </div>
      </div>
    </div>
  );
}

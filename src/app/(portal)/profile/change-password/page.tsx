import { ChangePasswordForm } from "@/components/portal/change-password-form";
import { PortalShell } from "@/components/portal/portal-shell";

export default function ChangePasswordPage() {
  return (
    <PortalShell
      title="Change password"
      summary="Password changes now stay inside the member portal and use Supabase Auth directly, with reauthentication support when the project policy requires a fresh proof of identity."
    >
      <section className="section-band grid gap-5">
        <div>
          <span className="eyebrow">Password security</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.4rem)] leading-[0.96] tracking-[-0.04em]">
            Update the password for the current signed-in account
          </h2>
        </div>
        <p className="section-copy">
          If Supabase requires reauthentication, send the one-time code to your
          email first and paste that nonce into the form before retrying the
          password update.
        </p>
        <ChangePasswordForm />
      </section>
    </PortalShell>
  );
}

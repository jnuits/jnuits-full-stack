import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";

export default function PortalAccessPendingPage() {
  return (
    <div>
      <span className="eyebrow">Access pending</span>
      <h1 className="section-title mt-4 text-[2.25rem]">
        Member portal access is not active yet.
      </h1>
      <p className="section-copy mt-3">
        You are signed in, but this account is not linked to an active member or
        alumni profile yet. If you received an invitation, claim the profile
        first. Otherwise, contact JnUITS support for help.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link className="primary-button" href="/register">
          Claim profile
        </Link>
        <LogoutButton
          className="secondary-button"
          redirectTo="/portal/login"
        />
      </div>
      <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
        <Link className="queue-link" href="mailto:info@jnuits.org.bd">
          Contact support
        </Link>
        <Link className="queue-link" href="/">
          Return home
        </Link>
      </div>
    </div>
  );
}

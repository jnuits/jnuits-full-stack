import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";

export default function AdminAccessPendingPage() {
  return (
    <div>
      <span className="eyebrow">Access pending</span>
      <h1 className="section-title mt-4 text-[2.25rem]">
        Admin access is not active for this account.
      </h1>
      <p className="section-copy mt-3">
        You are signed in, but this account does not currently have an operator
        role. Ask a JnUITS super admin to assign the correct access, then sign
        in again after the role update is complete.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <LogoutButton
          className="primary-button"
          redirectTo="/admin/login"
        />
        <Link className="secondary-button" href="mailto:info@jnuits.org.bd">
          Contact support
        </Link>
      </div>
      <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
        <Link className="queue-link" href="/portal/dashboard">
          Try member portal
        </Link>
        <Link className="queue-link" href="/">
          Return home
        </Link>
      </div>
    </div>
  );
}

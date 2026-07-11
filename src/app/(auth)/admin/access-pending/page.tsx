import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";

export default function AdminAccessPendingPage() {
  return (
    <div>
      <span className="eyebrow">Access pending</span>
      <h1 className="section-title mt-4 text-[2.25rem]">
        Admin access is unavailable for this account.
      </h1>
      <p className="section-copy mt-3">
        You are signed in, but this admin identity is pending, frozen, removed,
        or missing the required access. Ask a JnUITS super admin to review the
        account, then sign in again after any role or lifecycle change.
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

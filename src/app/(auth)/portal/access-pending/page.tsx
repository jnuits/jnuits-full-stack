import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function PortalAccessPendingPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // This hint changes explanatory text only; it never authorizes access.
  const restricted = typeof params.access === "string" && ["frozen", "suspended", "deactivated", "deletion_requested", "deleted"].includes(params.access);
  return (
    <div>
      <span className="eyebrow">{restricted ? "Access restricted" : "Access pending"}</span>
      <h1 className="section-title mt-4 text-[2.25rem]">
        {restricted ? "Member portal access is restricted." : "Member portal access is not active yet."}
      </h1>
      <p className="section-copy mt-3">
        {restricted ? "Your account is signed in, but its portal access has been restricted. Contact JnUITS support to review the restriction. Claiming a profile again cannot restore access." : <>You are signed in, but this account is not linked to an active member or
        alumni profile yet. If you received an invitation, claim the profile
        first. Otherwise, contact JnUITS support for help.</>}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {!restricted ? <Link className="primary-button" href="/register">
          Claim profile
        </Link> : null}
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

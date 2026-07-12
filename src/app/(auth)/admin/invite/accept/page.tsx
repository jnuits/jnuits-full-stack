import Link from "next/link";

import { acceptAdminInvitationAction } from "@/app/admin/admin-profiles/actions";
import type { AdminInvitationAcceptanceState } from "@/lib/admin/admin-invitation-flow";
import { requireAuthenticatedUser } from "@/lib/auth/session";

export const metadata = { title: "Accept Admin Invitation | JnUITS" };

const notices: Record<
  AdminInvitationAcceptanceState,
  { message: string; title: string }
> = {
  "claim-required": {
    title: "Claim your member profile first",
    message:
      "Use the member invitation email to claim the linked profile. After signing in with that same account, return here to confirm admin access.",
  },
  expired: {
    title: "This invitation has expired",
    message:
      "Ask a JnUITS super admin to issue a new admin invitation for this account.",
  },
  retry: {
    title: "Admin access was not activated",
    message:
      "Please try again. If the issue continues, ask a JnUITS super admin to review the pending invitation.",
  },
  "wrong-account": {
    title: "Use the invited account",
    message:
      "This invitation is tied to a different JnUITS account. Sign out and use the email address that received the invitation.",
  },
};

function getSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isAcceptanceState(
  value: string | undefined,
): value is AdminInvitationAcceptanceState {
  return Boolean(value && value in notices);
}

export default async function AdminInviteAcceptPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireAuthenticatedUser({ fallbackPath: "/admin/invite/accept" });
  const params = await searchParams;
  const state = getSearchParam(params.state);
  const notice = isAcceptanceState(state) ? notices[state] : null;
  const claimed = getSearchParam(params.claimed) === "1";

  return (
    <section className="mx-auto grid max-w-2xl gap-6 px-4 py-16">
      <div>
        <p className="eyebrow">Admin invitation</p>
        <h1 className="section-title mt-4 text-[2.25rem]">
          Accept admin workspace access
        </h1>
        <p className="section-copy mt-3">
          You are signed in as {auth.user?.email || "this account"}. Accepting
          activates the pending admin invitation for this account, then sends you
          to MFA setup.
        </p>
      </div>

      {claimed ? (
        <div className="rounded-lg border border-[var(--brand-green)]/35 bg-[var(--brand-green)]/10 p-4 text-sm leading-6 text-[var(--foreground)]">
          Your member profile is claimed. Confirm the pending admin access to
          continue.
        </div>
      ) : null}

      {notice ? (
        <div
          className="rounded-lg border border-[var(--brand-rust)]/35 bg-[var(--brand-rust)]/10 p-4"
          role="status"
        >
          <p className="font-semibold text-[var(--foreground)]">{notice.title}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
            {notice.message}
          </p>
        </div>
      ) : null}

      {state === "claim-required" ? (
        <div className="flex flex-wrap gap-3">
          <Link className="primary-button" href="/register">
            Claim member profile
          </Link>
          <Link className="secondary-button" href="/portal/login">
            Sign in after claiming
          </Link>
        </div>
      ) : (
        <form action={acceptAdminInvitationAction} className="flex flex-wrap gap-3">
          <button className="primary-button" type="submit">
            Accept invitation
          </button>
          <Link
            className="secondary-button"
            href="/portal/login?next=%2Fadmin%2Finvite%2Faccept"
          >
            Use another existing account
          </Link>
        </form>
      )}
    </section>
  );
}

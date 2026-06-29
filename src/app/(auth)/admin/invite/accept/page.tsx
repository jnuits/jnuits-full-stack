import Link from "next/link";

import { acceptAdminInvitationAction } from "@/app/admin/admin-profiles/actions";
import { requireAuthenticatedUser } from "@/lib/auth/session";

export const metadata = { title: "Accept Admin Invitation | JnUITS" };

export default async function AdminInviteAcceptPage() {
  const auth = await requireAuthenticatedUser({ fallbackPath: "/admin/invite/accept" });

  return (
    <section className="mx-auto grid max-w-2xl gap-6 px-4 py-16">
      <div>
        <p className="eyebrow">Admin invitation</p>
        <h1 className="section-title mt-4 text-[2.25rem]">
          Accept admin workspace access
        </h1>
        <p className="section-copy mt-3">
          You are signed in as {auth.user?.email || "this account"}. Accepting will activate the pending admin invitation for this user and then send you to MFA setup.
        </p>
      </div>
      <form action={acceptAdminInvitationAction} className="flex flex-wrap gap-3">
        <button className="primary-button" type="submit">
          Accept invitation
        </button>
        <Link className="secondary-button" href="/admin/login">
          Use another account
        </Link>
      </form>
    </section>
  );
}
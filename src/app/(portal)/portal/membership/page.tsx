import { redirect } from "next/navigation";
import { FormerMemberScreen, type MembershipView } from "@/components/portal/former-member-screen";
import { PortalShell } from "@/components/portal/portal-shell";
import { requirePortalIdentity, portalAccessRedirectPath } from "@/lib/auth/session";
import { getPortalMemberSnapshot } from "@/lib/portal/member";

export const metadata = { title: "Membership | JnUITS Member Portal" };

export default async function MembershipPage() {
  const auth = await requirePortalIdentity({ fallbackPath: "/portal/membership" });
  if (!auth.user) redirect("/portal/login");
  const snapshot = await getPortalMemberSnapshot(auth.user.id);
  const member = snapshot.membership;
  if (!member && auth.user.portalRole === "advisor") redirect("/portal");
  if (snapshot.access.mode === "blocked" || !member) redirect(portalAccessRedirectPath(snapshot.access));
  if (member.lifecycleStatus === "alumni") redirect("/portal");
  if (member.lifecycleStatus !== "current" && member.lifecycleStatus !== "former") redirect("/portal/access-pending");
  const view: MembershipView = {
    fullName: member.fullName, jnuitsId: member.jnuitsId, lifecycleStatus: member.lifecycleStatus,
    currentMembershipPathStatus: member.currentMembershipPathStatus ?? "", joinedOn: member.joinedOn,
    renewalDueOn: member.renewalDueOn, graceEndsOn: member.graceEndsOn, renewalState: member.renewalState,
    revision: member.revision, hasDepartureCase: Boolean(member.currentCaseId), hasAppeal: Boolean(member.appealId),
  };
  return <PortalShell accessMode={snapshot.access.mode} avatarUrl={member.avatarSecureUrl} memberName={member.fullName} jnuitsId={member.jnuitsId} portalRole={auth.user.portalRole}>
    <FormerMemberScreen membership={view} requests={snapshot.membershipRequests} />
  </PortalShell>;
}

export type NavItem = {
  href: string;
  label: string;
};

export const publicNavigation: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/events", label: "Events" },
  { href: "/blogs", label: "Blogs" },
  { href: "/gallery", label: "Gallery" },
  { href: "/committee", label: "Committee" },
  { href: "/members", label: "Members" },
  { href: "/certificates", label: "Certificates" },
  { href: "/contact", label: "Contact" },
];

export const implementationPhases = [
  "Phase 00: bootstrap, project standards, env contract, deployment wiring",
  "Phase 01: identity schema, RBAC, profiles, members, RLS baseline",
  "Phase 02: certificates import, parity report, verification, batch lookup",
  "Phase 03: public site shell, homepage, navbar, footer, contact, developers",
  "Phase 04: content collections, media handling, notices, blogs, events, gallery",
  "Phase 05: membership transition, public intake, claim flow, directory gate",
  "Phase 06: portal profile flows, workplace moderation, timeline, authoring",
  "Phase 07: admin queues, invitation batches, committees, audits, reconciliation",
  "Phase 08: rehearsal, rollback drill, cutover, stabilization",
];

export const portalNavigation: NavItem[] = [
  { href: "/portal", label: "Overview" },
  { href: "/profile", label: "Profile" },
  { href: "/profile/edit", label: "Edit Profile" },
  { href: "/profile/change-password", label: "Change Password" },
  { href: "/portal/blogs", label: "Draft Blogs" },
];

export const adminNavigation: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin#invitations", label: "Invitations" },
  { href: "/admin#moderation", label: "Moderation" },
  { href: "/admin#certificates", label: "Certificates" },
  { href: "/admin#reconcile", label: "Reconcile" },
];

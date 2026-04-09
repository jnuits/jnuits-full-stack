export type NavItem = {
  href: string;
  label: string;
};

export type ImplementationPhase = {
  id: string;
  summary: string;
  status: "Foundation" | "In Progress" | "Queued";
};

export const publicNavigation: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/events", label: "Events" },
  { href: "/blogs", label: "Blogs" },
  { href: "/gallery", label: "Gallery" },
  { href: "/projects", label: "Projects" },
  { href: "/committee", label: "Committee" },
  { href: "/members", label: "Members" },
  { href: "/certificates", label: "Certificates" },
  { href: "/contact", label: "Contact" },
];


export const implementationPhases: ImplementationPhase[] = [
  {
    id: "Phase 00",
    summary: "Bootstrap, project standards, environment contract, and deployment wiring.",
    status: "Foundation",
  },
  {
    id: "Phase 01",
    summary: "Identity schema, RBAC, profiles, members, and the RLS baseline.",
    status: "Foundation",
  },
  {
    id: "Phase 02",
    summary: "Certificates import, parity reporting, public verification, and batch lookup.",
    status: "Foundation",
  },
  {
    id: "Phase 03",
    summary: "Branded public shell, refined light/dark theme, header, footer, and key public routes.",
    status: "In Progress",
  },
  {
    id: "Phase 04",
    summary: "Content collections, media handling, notices, blogs, events, gallery, and about content.",
    status: "In Progress",
  },
  {
    id: "Phase 05",
    summary: "Membership transition, public intake, claim flow, and directory verification.",
    status: "In Progress",
  },
  {
    id: "Phase 06",
    summary: "Portal profile flows, workplace moderation, timeline, password security, and member authoring.",
    status: "In Progress",
  },
  {
    id: "Phase 07",
    summary: "Admin queues, invitation batches, committees, audits, and reconciliation tooling.",
    status: "In Progress",
  },
  {
    id: "Phase 08",
    summary: "Rehearsal, rollback drill, cutover preparation, and production stabilization.",
    status: "Queued",
  },
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
  { href: "/admin/membership", label: "Membership" },
  { href: "/admin/committee", label: "Committee" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin#applications", label: "Applications" },
  { href: "/admin#invitations", label: "Invitations" },
  { href: "/admin#workplace", label: "Workplace" },
  { href: "/admin#profile-requests", label: "Profile" },
  { href: "/admin#decisions", label: "Decisions" },
  { href: "/admin#certificates", label: "Certificates" },
  { href: "/admin#reconcile", label: "Reconcile" },
];

export type NavItem = {
  href: string;
  label: string;
  description?: string;
};

export type ImplementationPhase = {
  id: string;
  summary: string;
  status: "Foundation" | "In Progress" | "Queued";
};

export const publicPrimaryNavigation: NavItem[] = [
  { href: "/about", label: "About" },
  { href: "/committee", label: "Committee" },
  { href: "/notices", label: "Notices" },
  { href: "/events", label: "Events" },
  { href: "/members", label: "Members" },
  { href: "/contact", label: "Contact" },
];

export const publicMemberNavigation: NavItem[] = [
  {
    href: "/members",
    label: "Members directory",
    description: "Browse listed members and alumni with permanent JnUITS IDs.",
  },
  {
    href: "/membership-form",
    label: "Application form",
    description: "Check application status and membership onboarding options.",
  },
  {
    href: "/register",
    label: "Claim profile",
    description: "Use an invitation code to claim an existing member profile.",
  },
  {
    href: "/alumni",
    label: "Join alumni",
    description: "Request alumni access even if your past profile is not listed yet.",
  },
];

export const publicResourceNavigation: NavItem[] = [
  {
    href: "/blogs",
    label: "Blogs",
    description: "Stories, recaps, and member-written updates.",
  },
  {
    href: "/certificates",
    label: "Certificates",
    description: "Verify issued course and event certificates.",
  },
  {
    href: "/gallery",
    label: "Gallery",
    description: "Photos and videos from society activities.",
  },
  {
    href: "/projects",
    label: "Projects",
    description: "Technical portfolios and society-built initiatives.",
  },
];

export const publicFooterNavigation: NavItem[] = [
  { href: "/developers", label: "Developers" },
  { href: "/membership-form", label: "Membership form" },
];

export const publicPolicyNavigation: NavItem[] = [
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-of-service", label: "Terms of Service" },
  { href: "/cookie-policy", label: "Cookie Policy" },
];

// Complete public route inventory used by sitemap.xml.
export const publicNavigation: NavItem[] = [
  { href: "/", label: "Home" },
  ...publicFooterNavigation,
  ...publicPrimaryNavigation,
  ...publicMemberNavigation,
  ...publicResourceNavigation,
  ...publicPolicyNavigation,
].filter(
  (item, index, items) =>
    items.findIndex((candidate) => candidate.href === item.href) === index
);


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
  { href: "/portal/profile", label: "My Profile" },
  { href: "/portal/profile/edit", label: "Edit Profile" },
  { href: "/portal/advisor/profile", label: "Advisor Profile" },
  { href: "/portal/blogs", label: "Draft Blogs" },
  { href: "/portal/tickets", label: "Tickets" },
  { href: "/portal/mentorship", label: "Mentorship" },
  { href: "/portal/projects", label: "My Projects" },
  { href: "/portal/activity", label: "Activity" },
  { href: "/portal/profile/change-password", label: "Password" },
];

export const adminNavigation: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/invitations", label: "Invitations" },
  { href: "/admin/workplace", label: "Workplace" },
  { href: "/admin/profile-changes", label: "Profile Changes" },
  { href: "/admin/membership", label: "Membership DB" },
  { href: "/admin/bulk-operations", label: "Bulk Operations" },
  { href: "/admin/content", label: "Content Hub" },
  { href: "/admin/content/media", label: "Media" },
  { href: "/admin/content/blogs", label: "Blogs" },
  { href: "/admin/content/events", label: "Events" },
  { href: "/admin/content/gallery", label: "Gallery" },
  { href: "/admin/content/projects", label: "Projects" },
  { href: "/admin/content/pages", label: "Page Singletons" },
  { href: "/admin/committee", label: "Committee" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/reconcile", label: "Reconcile" },
  { href: "/admin/certificates", label: "Certificates" },
  { href: "/admin/decisions", label: "Decisions Log" },
  { href: "/admin/admin-profiles", label: "Admin Profiles" },
  { href: "/admin/settings/profile", label: "Profile Settings" },
  { href: "/admin/settings/security", label: "Security Settings" },
  { href: "/admin/settings/notifications", label: "Notification Settings" },
];

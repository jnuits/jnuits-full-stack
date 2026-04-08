export type AboutValue = {
  title: string;
  description: string;
};

export type BlogPreview = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  excerpt: string;
  publishedAt: string;
  readTime: string;
  imageSrc: string;
};

export type EventPreview = {
  slug: string;
  title: string;
  status: "Upcoming" | "Ongoing" | "Archive";
  summary: string;
  location: string;
  start: string;
  end: string;
  imageSrc: string;
  focus: string;
};

export type NoticePreview = {
  title: string;
  category: string;
  publishedAt: string;
  summary: string;
  delivery: "Attachment migration queued" | "Read route ready" | "External action";
  href?: string;
};

export type GalleryPreview = {
  title: string;
  caption: string;
  imageSrc: string;
};

export type DeveloperPreview = {
  name: string;
  role: string;
  focus: string;
  bio: string;
  imageSrc?: string;
  lead?: boolean;
};

export const aboutContent = {
  eyebrow: "Institutional profile",
  title: "JnUITS connects students, builders, and operators around practical digital work.",
  summary:
    "The old site already proved that JnUITS needs more than a brochure. It needs a public face for announcements and history, a safe member space, and operator tooling that can survive real organizational work without depending on an opaque proxy chain.",
  story: [
    "The society sits at the intersection of technical learning, campus community, and operational stewardship.",
    "This rebuild keeps the public mission visible while making internal workflows more explicit, more auditable, and less fragile.",
  ],
  missionTitle: "What Phase 04 is restoring from the previous platform",
  missionPoints: [
    "Public storytelling for achievements, events, notices, and committee history.",
    "Route-by-route parity with the legacy site so migration can happen without breaking trust.",
    "A content architecture that later moves from local previews into Supabase-backed collections and media delivery.",
  ],
  values: [
    {
      title: "Practical learning",
      description:
        "Programs, workshops, and member work should produce visible outcomes, not just announcements.",
    },
    {
      title: "Safe participation",
      description:
        "Members should contribute through focused tools instead of broad access to unsafe admin surfaces.",
    },
    {
      title: "Operational clarity",
      description:
        "Approvals, publishing, and member-state changes should leave evidence that operators can trust later.",
    },
  ] satisfies AboutValue[],
  imageSrc: "/images/workshop.jpg",
};

export const publicBlogs: BlogPreview[] = [
  {
    slug: "building-the-unified-stack",
    title: "Building the unified stack without repeating the proxy-era mistakes",
    category: "Platform",
    summary:
      "The rebuild aligns public routes, member identity, and operator workflows around one audited app instead of a split CMS chain.",
    excerpt:
      "This editorial preview captures the real migration goal: fewer moving pieces, stronger auth boundaries, and less hidden coupling between the website and internal operations.",
    publishedAt: "2026-04-06",
    readTime: "6 min read",
    imageSrc: "/images/home-group.jpg",
  },
  {
    slug: "certificate-verification-without-the-proxy",
    title: "Certificate verification is now a first-class product surface",
    category: "Certificates",
    summary:
      "Certificates were prioritized early because public trust depends on them working reliably before richer content lands.",
    excerpt:
      "Import staging, parity checks, and public verification are already live. The content lane now has to match that level of clarity and confidence.",
    publishedAt: "2026-03-28",
    readTime: "4 min read",
    imageSrc: "/images/achievement.jpg",
  },
  {
    slug: "designing-a-safer-member-portal",
    title: "Designing a safer member portal for a non-technical organization",
    category: "Portal",
    summary:
      "Committee and member authors need focused tools, not a wide operator console that exposes risky controls by accident.",
    excerpt:
      "The portal remains intentionally narrow while approvals, invitations, and reconciliation stay inside an auditable admin workspace.",
    publishedAt: "2026-03-17",
    readTime: "5 min read",
    imageSrc: "/images/workshop.jpg",
  },
];

export const publicEvents: EventPreview[] = [
  {
    slug: "spring-builder-session",
    title: "Spring Builder Session",
    status: "Upcoming",
    summary:
      "A practical workshop cycle around software delivery, infrastructure thinking, and shipping safer campus-facing tools.",
    location: "Jagannath University ICT Lab",
    start: "2026-05-12T10:00:00+06:00",
    end: "2026-05-12T16:00:00+06:00",
    imageSrc: "/images/workshop.jpg",
    focus: "Hands-on delivery",
  },
  {
    slug: "certificate-validation-clinic",
    title: "Certificate Validation Clinic",
    status: "Ongoing",
    summary:
      "Operators walk through the new import and parity workflow so the certificate lane can be trusted before final data cutover.",
    location: "JnUITS Working Session",
    start: "2026-04-08T12:00:00+06:00",
    end: "2026-04-10T18:00:00+06:00",
    imageSrc: "/images/achievement.jpg",
    focus: "Migration rehearsal",
  },
  {
    slug: "society-roadmap-townhall",
    title: "Society Roadmap Townhall",
    status: "Archive",
    summary:
      "A campus-facing review of what the new website, member portal, and operator stack are changing for the organization.",
    location: "Central Auditorium",
    start: "2026-03-14T15:00:00+06:00",
    end: "2026-03-14T17:00:00+06:00",
    imageSrc: "/images/home-group.jpg",
    focus: "Public accountability",
  },
];

export const publicNotices: NoticePreview[] = [
  {
    title: "Membership review queue is now live in the unified admin workspace",
    category: "Operations",
    publishedAt: "2026-04-08",
    summary:
      "New applications can now be reviewed, approved into member records, and turned into claim invitations without using the legacy admin.",
    delivery: "Read route ready",
    href: "/admin",
  },
  {
    title: "Certificate import parity rehearsal continues this week",
    category: "Certificates",
    publishedAt: "2026-04-07",
    summary:
      "The import lane is stable, but final source CSV delivery and report archiving are still required before production cutover.",
    delivery: "Read route ready",
    href: "/certificates",
  },
  {
    title: "Public content migration is entering structured preview mode",
    category: "Website",
    publishedAt: "2026-04-06",
    summary:
      "About, blogs, events, gallery, and developer surfaces are being rebuilt around stable route-level data contracts before database-backed collections land.",
    delivery: "Read route ready",
    href: "/about",
  },
  {
    title: "Attachment handling remains phase-gated until media import rules are finalized",
    category: "Media",
    publishedAt: "2026-04-05",
    summary:
      "Legacy files and images are being normalized so future public delivery can preserve links without leaking private storage paths.",
    delivery: "Attachment migration queued",
  },
];

export const publicGallery: GalleryPreview[] = [
  {
    title: "Community orientation and project showcase",
    caption:
      "Legacy photography is being reused as the first public media layer while the new gallery model is prepared.",
    imageSrc: "/images/gallery-1.jpg",
  },
  {
    title: "Program day atmosphere",
    caption:
      "Events and workshops remain central to the public identity of the society, so the new gallery must support both archive and atmosphere.",
    imageSrc: "/images/gallery-2.jpg",
  },
  {
    title: "Large-format public moments",
    caption:
      "Phase 04 is as much about visual memory as it is about data modeling; the route should feel alive before import tooling is complete.",
    imageSrc: "/images/gallery-3.jpg",
  },
];

export const developerCredits = {
  lead: {
    name: "Md. Redwan Ahmed",
    role: "Platform architecture and migration lead",
    focus: "Unified stack delivery, auth boundaries, and rollout planning.",
    bio: "Leading the move from the split stack toward one operationally coherent application.",
    imageSrc: "/images/developer-redwan.jpg",
    lead: true,
  } satisfies DeveloperPreview,
  team: [
    {
      name: "Sajeeb Saha",
      role: "Frontend systems and experience delivery",
      focus: "Public interface polish, content surfaces, and route experience.",
      bio: "Carrying forward the visual identity and making the public routes feel intentional during migration.",
      imageSrc: "/images/developer-sajeeb.png",
    },
    {
      name: "JnUITS migration track",
      role: "Content and operations contributors",
      focus: "Legacy review, data parity, and public-route stabilization.",
      bio: "The broader migration effort combines technical implementation with operational cleanup and editorial parity work.",
    },
  ] satisfies DeveloperPreview[],
};

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const compactDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export function formatDisplayDate(value: string) {
  return shortDate.format(new Date(value));
}

export function formatDateRange(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (startDate.toDateString() === endDate.toDateString()) {
    return `${shortDate.format(startDate)} • ${startDate.toLocaleTimeString("en-BD", {
      hour: "numeric",
      minute: "2-digit",
    })} - ${endDate.toLocaleTimeString("en-BD", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  return `${compactDate.format(startDate)} - ${shortDate.format(endDate)}`;
}

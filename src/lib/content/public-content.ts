import { cache } from "react";
import { brandProfile } from "@/lib/branding";
import type { Json, Tables } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";

export type AboutValue = {
  icon?: string;
  title: string;
  description: string;
};

export type AboutStats = {
  active_members: string;
  events_organized: string;
  years_active: string;
  major_award: string;
};

export type AboutProgram = {
  icon: string;
  title: string;
  desc: string;
};

export type AboutTimelineEntry = {
  date: string;
  event: string;
};

export type AboutSocialChannel = {
  platform: string;
  handle: string;
  url: string;
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
  delivery: "File link pending" | "Read route ready" | "External action";
  href?: string;
};

export type GalleryPreview = {
  identifier: string;
  title: string;
  caption: string;
  imageSrc: string;
};

export type BlogDetail = BlogPreview & {
  body: string;
  ctaHref: null | string;
  id: string;
};

export type EventDetail = EventPreview & {
  body: null | string;
  ctaHref: null | string;
  id: string;
};

export type GalleryDetail = GalleryPreview & {
  id: string;
  mediaKind: "image" | "video";
  secureUrl: string;
  thumbnailUrl: null | string;
};

export type DeveloperPreview = {
  name: string;
  role: string;
  focus: string;
  bio: string;
  imageSrc?: string;
  lead?: boolean;
};

type ContentPostRecord = Tables<"content_posts">;
type DeveloperProfileRecord = Tables<"developer_profiles">;
type MediaAssetRecord = Pick<
  Tables<"media_assets">,
  "alt_text" | "media_kind" | "secure_url" | "thumbnail_url" | "title"
>;
type GalleryEntryPublicRecord = Pick<
  Tables<"gallery_entries">,
  "caption" | "id" | "sort_order" | "title"
> & {
  media_assets?: MediaAssetRecord | MediaAssetRecord[] | null;
};

const contentPostSelect =
  "id, slug, title, category, summary, excerpt, body, published_at, read_time, location, starts_at, ends_at, cta_href, content_type, status, media_assets(secure_url, thumbnail_url, alt_text, title, media_kind)";
const galleryEntrySelect =
  "id, title, caption, sort_order, media_assets(secure_url, thumbnail_url, alt_text, title, media_kind)";

const fallbackBlogImage = "/images/home-group.jpg";
const fallbackEventImage = "/images/workshop.jpg";
const fallbackNoticeHref = "/notices";

export const fallbackAboutContent = {
  eyebrow: brandProfile.slogan,
  title: `About ${brandProfile.fullName}`,
  summary:
    `${brandProfile.fullName} (${brandProfile.shortName}) is the non-profit university IT club of ${brandProfile.university}, founded and registered on 11 Nov 2015 and approved by the University on 18 Nov 2015.`,
  heroDescription:
    `${brandProfile.fullName} (${brandProfile.shortName}) is a non-profit university IT club helping students learn, build, and lead through practical technology programs, public events, trusted digital services, and a collaborative community at ${brandProfile.university} in Dhaka.`,
  story: [
    `${brandProfile.shortName} brings together students who want to learn, build, and lead through practical work in information technology.`,
    `From ${brandProfile.address}, the society runs programs, courses, workshops, certificates, and community activities that help students move forward with confidence.`,
  ],
  missionTitle: "What JnUITS stands for",
  missionStatement:
    `${brandProfile.shortName} exists to develop practical technology skills through courses, workshops, seminars, and technical events, while building a collaborative community for technology-minded students at ${brandProfile.university} with trusted public communication and durable digital operations.`,
  missionPoints: [
    "Practical skill development through courses, workshops, seminars, and technical events.",
    "A collaborative community for technology-minded students at Jagannath University.",
    "Visible institutional trust through certificate verification, public communication, and durable digital operations.",
  ],
  stats: {
    active_members: "250+",
    events_organized: "50+",
    years_active: "10+",
    major_award: "1st Place, Bangladesh IT Challenge 2023",
  } satisfies AboutStats,
  vision:
    "Our vision is to build a vibrant, inclusive and globally competitive tech community at Jagannath University that leads innovation, drives social impact, and shapes the digital future of Bangladesh.",
  programs: [
    {
      icon: "💻",
      title: "Workshops & Courses",
      desc: "Hands-on sessions on web development and modern technologies",
    },
    {
      icon: "🏆",
      title: "Coding Competitions",
      desc: "Programming contests and challenges with prizes",
    },
    {
      icon: "🎤",
      title: "Seminars & Tech Talks",
      desc: "Industry expert sessions bridging academia and industry",
    },
    {
      icon: "🌍",
      title: "Community Outreach",
      desc: "Social impact and sustainability-oriented initiatives",
    },
  ] satisfies AboutProgram[],
  values: [
    {
      icon: "📈",
      title: "Growth & Excellence",
      description:
        "We encourage continuous learning, technical confidence, and visible progress through practical work.",
    },
    {
      icon: "💡",
      title: "Innovation & Creativity",
      description:
        "We create room for original ideas, experimentation, and student-led technology initiatives.",
    },
    {
      icon: "🤝",
      title: "Diversity & Inclusion",
      description:
        "We welcome students with different backgrounds, interests, and experience levels into one community.",
    },
    {
      icon: "🌱",
      title: "Sustainability & Social Impact",
      description:
        "We support technology work that benefits people, institutions, and the wider society responsibly.",
    },
    {
      icon: "🌐",
      title: "Collaboration & Community",
      description:
        "We grow through teamwork, peer support, shared knowledge, and strong institutional relationships.",
    },
  ] satisfies AboutValue[],
  timeline: [
    { date: "11 Nov 2015", event: "Founded and registered" },
    { date: "18 Nov 2015", event: "Approved by Jagannath University" },
    { date: "2023", event: "1st Place, Bangladesh IT Challenge" },
  ] satisfies AboutTimelineEntry[],
  socialChannels: [
    {
      platform: "Website",
      handle: "jnuits.org.bd",
      url: "https://jnuits.org.bd",
    },
    {
      platform: "Facebook",
      handle: "/jnuits",
      url: "https://www.facebook.com/jnuits",
    },
    {
      platform: "Facebook Group",
      handle: "/groups/jnuits",
      url: "https://www.facebook.com/groups/jnuits",
    },
    {
      platform: "LinkedIn",
      handle: "JnUITS",
      url: "https://bd.linkedin.com/company/jnuits",
    },
    {
      platform: "Instagram",
      handle: "@jnuitsbd",
      url: "https://www.instagram.com/jnuitsbd/",
    },
  ] satisfies AboutSocialChannel[],
  imageSrc: "/images/workshop.jpg",
};

export const fallbackPublicBlogs: BlogPreview[] = [
  {
    slug: "society-program-highlights",
    title: "Society program highlights for the current session",
    category: "Programs",
    summary:
      "JnUITS continues to run practical learning activities for students through workshops, guided sessions, and public-facing events.",
    excerpt:
      "The society prioritizes consistent program delivery, transparent communication, and student participation across each semester.",
    publishedAt: "2026-04-06",
    readTime: "6 min read",
    imageSrc: "/images/home-group.jpg",
  },
  {
    slug: "certificate-verification-guidelines",
    title: "Certificate verification guidelines for participants",
    category: "Certificates",
    summary:
      "JnUITS certificates are issued for eligible programs and can be verified from the official public verification route.",
    excerpt:
      "Participants and partner organizations can confirm certificate validity using the certificate ID from official documents.",
    publishedAt: "2026-03-28",
    readTime: "4 min read",
    imageSrc: "/images/achievement.jpg",
  },
  {
    slug: "member-community-updates",
    title: "Member community updates and participation pathways",
    category: "Community",
    summary:
      "The society supports active student participation through committees, member-led activities, and constructive collaboration.",
    excerpt:
      "Community updates cover membership activities, public initiatives, and opportunities for students to contribute.",
    publishedAt: "2026-03-17",
    readTime: "5 min read",
    imageSrc: "/images/workshop.jpg",
  },
];

export const fallbackPublicEvents: EventPreview[] = [
  {
    slug: "spring-it-workshop-series",
    title: "Spring IT Workshop Series",
    status: "Upcoming",
    summary:
      "A student-focused workshop cycle covering practical digital skills, peer learning, and project collaboration.",
    location: "Jagannath University ICT Lab",
    start: "2026-05-12T10:00:00+06:00",
    end: "2026-05-12T16:00:00+06:00",
    imageSrc: "/images/workshop.jpg",
    focus: "Hands-on learning",
  },
  {
    slug: "certificate-verification-support-session",
    title: "Certificate Verification Support Session",
    status: "Ongoing",
    summary:
      "An open support session for participants who need guidance on certificate verification and official confirmation.",
    location: "JnUITS Help Desk Session",
    start: "2026-04-08T12:00:00+06:00",
    end: "2026-04-10T18:00:00+06:00",
    imageSrc: "/images/achievement.jpg",
    focus: "Public support",
  },
  {
    slug: "campus-tech-community-townhall",
    title: "Campus Tech Community Townhall",
    status: "Archive",
    summary:
      "A public session where members reviewed society goals, event outcomes, and future technology initiatives.",
    location: "Central Auditorium",
    start: "2026-03-14T15:00:00+06:00",
    end: "2026-03-14T17:00:00+06:00",
    imageSrc: "/images/home-group.jpg",
    focus: "Community planning",
  },
];

export const fallbackPublicNotices: NoticePreview[] = [
  {
    title: "Membership onboarding and status support",
    category: "Membership",
    publishedAt: "2026-04-08",
    summary:
      "New public intake is closed. Existing applicants can check status while invitation and claim support remains active.",
    delivery: "Read route ready",
    href: "/membership-form",
  },
  {
    title: "Certificate verification support information",
    category: "Certificates",
    publishedAt: "2026-04-07",
    summary:
      "Certificate holders should use the official verification route for status checks and follow-up support.",
    delivery: "Read route ready",
    href: "/certificates",
  },
  {
    title: "Upcoming programs and community activities",
    category: "Website",
    publishedAt: "2026-04-06",
    summary:
      "Recent announcements and public updates are published through the notices and events sections.",
    delivery: "Read route ready",
    href: "/events",
  },
  {
    title: "Document and attachment links",
    category: "Media",
    publishedAt: "2026-04-05",
    summary:
      "Some notices include external or downloadable resources and will open from the linked action.",
    delivery: "File link pending",
  },
];

export const fallbackPublicGallery: GalleryPreview[] = [
  {
    identifier: "community-orientation-showcase",
    title: "Community orientation and project showcase",
    caption:
      "A glimpse of society sessions where students collaborate through practical technology activities.",
    imageSrc: "/images/gallery-1.jpg",
  },
  {
    identifier: "program-day-atmosphere",
    title: "Program day atmosphere",
    caption:
      "Workshops and community programs continue to shape the public identity of JnUITS.",
    imageSrc: "/images/gallery-2.jpg",
  },
  {
    identifier: "annual-activity-moments",
    title: "Large-format public moments",
    caption:
      "Selected activity moments from society programs, ceremonies, and student-focused events.",
    imageSrc: "/images/gallery-3.jpg",
  },
];

export const fallbackDeveloperCredits = {
  lead: {
    name: "Md. Redwan Ahmed",
    role: "Platform and engineering lead",
    focus: "Platform reliability, secure delivery, and operational continuity.",
    bio: "Leads engineering execution for JnUITS public and member-facing systems.",
    imageSrc: "/images/developer-redwan.jpg",
    lead: true,
  } satisfies DeveloperPreview,
  team: [
    {
      name: "Sajeeb Saha",
      role: "Frontend and experience delivery",
      focus: "Public interface quality, accessibility, and content presentation.",
      bio: "Contributes to public experience quality and member-facing product polish.",
      imageSrc: "/images/developer-sajeeb.png",
    },
    {
      name: "JnUITS technical contributors",
      role: "Content and operations support",
      focus: "Data quality, operational support, and service continuity.",
      bio: "A broader contributor team supports product operations, content readiness, and delivery quality.",
    },
  ] satisfies DeveloperPreview[],
};

export const aboutContent = fallbackAboutContent;
export const publicBlogs = fallbackPublicBlogs;
export const publicEvents = fallbackPublicEvents;
export const publicNotices = fallbackPublicNotices;
export const publicGallery = fallbackPublicGallery;
export const developerCredits = fallbackDeveloperCredits;

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const compactDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function asObject(value: Json | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : null;
}

function asString(value: Json | undefined, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asStringArray(value: Json | undefined, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);

  return normalized.length > 0 ? normalized : fallback;
}

function asAboutValues(value: Json | undefined, fallback: AboutValue[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const record = entry as Record<string, Json | undefined>;
      const icon = asString(record.icon);
      const title = asString(record.title);
      const description = asString(record.description);

      if (!title || !description) {
        return null;
      }

      return icon ? { icon, title, description } : { title, description };
    })
    .filter((entry): entry is AboutValue => Boolean(entry));

  return normalized.length > 0 ? normalized : fallback;
}

function asAboutStats(value: Json | undefined, fallback: AboutStats) {
  const record = asObject(value);

  if (!record) {
    return fallback;
  }

  return {
    active_members: asString(record.active_members, fallback.active_members),
    events_organized: asString(record.events_organized, fallback.events_organized),
    years_active: asString(record.years_active, fallback.years_active),
    major_award: asString(record.major_award, fallback.major_award),
  } satisfies AboutStats;
}

function asAboutPrograms(value: Json | undefined, fallback: AboutProgram[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const record = entry as Record<string, Json | undefined>;
      const icon = asString(record.icon);
      const title = asString(record.title);
      const desc = asString(record.desc);

      if (!icon || !title || !desc) {
        return null;
      }

      return { icon, title, desc };
    })
    .filter((entry): entry is AboutProgram => Boolean(entry));

  return normalized.length > 0 ? normalized : fallback;
}

function asAboutTimeline(value: Json | undefined, fallback: AboutTimelineEntry[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const record = entry as Record<string, Json | undefined>;
      const date = asString(record.date);
      const event = asString(record.event);

      if (!date || !event) {
        return null;
      }

      return { date, event };
    })
    .filter((entry): entry is AboutTimelineEntry => Boolean(entry));

  return normalized.length > 0 ? normalized : fallback;
}

function asAboutSocialChannels(value: Json | undefined, fallback: AboutSocialChannel[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const record = entry as Record<string, Json | undefined>;
      const platform = asString(record.platform);
      const handle = asString(record.handle);
      const url = asString(record.url);

      if (!platform || !handle || !url) {
        return null;
      }

      return { platform, handle, url };
    })
    .filter((entry): entry is AboutSocialChannel => Boolean(entry));

  return normalized.length > 0 ? normalized : fallback;
}

function resolveRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

function resolveImage(media: MediaAssetRecord | MediaAssetRecord[] | null | undefined, fallback: string) {
  const resolved = resolveRelation(media);

  if (!resolved) {
    return fallback;
  }

  if (resolved.media_kind === "video") {
    return resolved.thumbnail_url || fallback;
  }

  return resolved.secure_url || fallback;
}

function normalizeIdentifier(value: string) {
  try {
    return decodeURIComponent(String(value || "").trim()).toLowerCase();
  } catch {
    return String(value || "").trim().toLowerCase();
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function slugifyValue(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 120);
}

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

export const getAboutContent = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_pages")
    .select("slug, title, eyebrow, summary, body")
    .eq("slug", "about")
    .eq("status", "published")
    .maybeSingle();

  if (!data) {
    return fallbackAboutContent;
  }

  const body = asObject(data.body);

  return {
    eyebrow: data.eyebrow || fallbackAboutContent.eyebrow,
    title: data.title || fallbackAboutContent.title,
    summary: data.summary || fallbackAboutContent.summary,
    heroDescription: asString(
      body?.heroDescription || body?.hero_description,
      fallbackAboutContent.heroDescription
    ),
    story: asStringArray(body?.story, fallbackAboutContent.story),
    missionTitle: asString(body?.missionTitle, fallbackAboutContent.missionTitle),
    missionStatement: asString(
      body?.missionStatement || body?.mission_statement,
      fallbackAboutContent.missionStatement
    ),
    missionPoints: asStringArray(
      body?.missionPoints,
      fallbackAboutContent.missionPoints
    ),
    stats: asAboutStats(body?.stats, fallbackAboutContent.stats),
    vision: asString(body?.vision, fallbackAboutContent.vision),
    programs: asAboutPrograms(body?.programs, fallbackAboutContent.programs),
    values: asAboutValues(body?.values, fallbackAboutContent.values),
    timeline: asAboutTimeline(body?.timeline, fallbackAboutContent.timeline),
    socialChannels: asAboutSocialChannels(
      body?.socialChannels || body?.social_channels,
      fallbackAboutContent.socialChannels
    ),
    imageSrc: asString(body?.imageSrc, fallbackAboutContent.imageSrc),
  };
});

export const getPublishedBlogs = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_posts")
    .select(contentPostSelect)
    .eq("content_type", "blog")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(24);

  if (!data || data.length === 0) {
    return fallbackPublicBlogs;
  }

  return data.map((record, index) => {
    const media = (
      record as ContentPostRecord & {
        media_assets?: MediaAssetRecord | MediaAssetRecord[] | null;
      }
    ).media_assets;

    return {
      slug: record.slug,
      title: record.title,
      category: record.category || "Blog",
      summary: record.summary || record.excerpt || "Public editorial item.",
      excerpt:
        record.excerpt ||
        record.summary ||
        "This public editorial entry is now served from the moderated content model.",
      publishedAt:
        record.published_at ||
        fallbackPublicBlogs[index]?.publishedAt ||
        new Date().toISOString(),
      readTime: record.read_time || fallbackPublicBlogs[index]?.readTime || "5 min read",
      imageSrc: resolveImage(media, fallbackPublicBlogs[index]?.imageSrc || fallbackBlogImage),
    } satisfies BlogPreview;
  });
});

function mapEventStatus(value: string | null | undefined): EventPreview["status"] {
  if (value === "archived") {
    return "Archive";
  }

  if (value === "published") {
    return "Ongoing";
  }

  return "Upcoming";
}

export const getPublishedEvents = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_posts")
    .select(contentPostSelect)
    .eq("content_type", "event")
    .eq("status", "published")
    .order("starts_at", { ascending: true })
    .limit(24);

  if (!data || data.length === 0) {
    return fallbackPublicEvents;
  }

  return data.map((record, index) => {
    const media = (
      record as ContentPostRecord & {
        media_assets?: MediaAssetRecord | MediaAssetRecord[] | null;
      }
    ).media_assets;

    return {
      slug: record.slug,
      title: record.title,
      status: mapEventStatus(record.status),
      summary: record.summary || "Public event entry.",
      location: record.location || "Location to be confirmed",
      start:
        record.starts_at ||
        fallbackPublicEvents[index]?.start ||
        new Date().toISOString(),
      end:
        record.ends_at ||
        record.starts_at ||
        fallbackPublicEvents[index]?.end ||
        new Date().toISOString(),
      imageSrc: resolveImage(media, fallbackPublicEvents[index]?.imageSrc || fallbackEventImage),
      focus: record.category || fallbackPublicEvents[index]?.focus || "Program stream",
    } satisfies EventPreview;
  });
});

export const getPublishedNotices = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_posts")
    .select("title, category, summary, published_at, cta_href")
    .eq("content_type", "notice")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(24);

  if (!data || data.length === 0) {
    return fallbackPublicNotices;
  }

  return data.map((record, index) => ({
    title: record.title,
    category: record.category || "Notice",
    publishedAt:
      record.published_at ||
      fallbackPublicNotices[index]?.publishedAt ||
      new Date().toISOString(),
    summary: record.summary || "Public notice entry.",
    delivery: record.cta_href ? "External action" : "Read route ready",
    href: record.cta_href || fallbackPublicNotices[index]?.href || fallbackNoticeHref,
  })) satisfies NoticePreview[];
});

export const getPublishedGallery = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gallery_entries")
    .select(galleryEntrySelect)
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .limit(24);

  if (!data || data.length === 0) {
    return fallbackPublicGallery;
  }

  const galleryRows = (data || []) as GalleryEntryPublicRecord[];

  return galleryRows.map((record, index) => {
    const media = record.media_assets;

    return {
      identifier: record.id,
      title: record.title,
      caption: record.caption || fallbackPublicGallery[index]?.caption || "",
      imageSrc: resolveImage(
        media,
        fallbackPublicGallery[index]?.imageSrc || fallbackPublicGallery[0].imageSrc
      ),
    } satisfies GalleryPreview;
  });
});

export const getPublishedDevelopers = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("developer_profiles")
    .select("name, role, focus, bio, is_lead, media_assets(secure_url, thumbnail_url, alt_text, title, media_kind)")
    .eq("status", "published")
    .order("is_lead", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(24);

  if (!data || data.length === 0) {
    return [fallbackDeveloperCredits.lead, ...fallbackDeveloperCredits.team];
  }

  return data.map((record, index) => {
    const media = (
      record as DeveloperProfileRecord & {
        media_assets?: MediaAssetRecord | MediaAssetRecord[] | null;
      }
    ).media_assets;

    return {
      name: record.name,
      role: record.role,
      focus: record.focus,
      bio: record.bio,
      imageSrc: resolveImage(
        media,
        index === 0
          ? fallbackDeveloperCredits.lead.imageSrc || "/logo.svg"
          : fallbackDeveloperCredits.team[index - 1]?.imageSrc || "/logo.svg"
      ),
      lead: record.is_lead,
    } satisfies DeveloperPreview;
  });
});

function mapBlogDetail(
  record: ContentPostRecord & {
    media_assets?: MediaAssetRecord | MediaAssetRecord[] | null;
  }
): BlogDetail {
  return {
    body: record.body || "",
    category: record.category || "Blog",
    ctaHref: record.cta_href,
    excerpt:
      record.excerpt ||
      record.summary ||
      "Public editorial entry from Jagannath University IT Society.",
    id: record.id,
    imageSrc: resolveImage(record.media_assets, fallbackBlogImage),
    publishedAt: record.published_at || new Date().toISOString(),
    readTime: record.read_time || "5 min read",
    slug: record.slug,
    summary: record.summary || record.excerpt || "Public editorial entry.",
    title: record.title,
  };
}

function mapEventDetail(
  record: ContentPostRecord & {
    media_assets?: MediaAssetRecord | MediaAssetRecord[] | null;
  }
): EventDetail {
  return {
    body: record.body,
    ctaHref: record.cta_href,
    end: record.ends_at || record.starts_at || new Date().toISOString(),
    focus: record.category || "Program stream",
    id: record.id,
    imageSrc: resolveImage(record.media_assets, fallbackEventImage),
    location: record.location || "Location to be confirmed",
    slug: record.slug,
    start: record.starts_at || new Date().toISOString(),
    status: mapEventStatus(record.status),
    summary: record.summary || "Public event entry.",
    title: record.title,
  };
}

function mapGalleryDetail(
  record: GalleryEntryPublicRecord
): GalleryDetail {
  const resolvedMedia = resolveRelation(record.media_assets);
  const mediaKind = resolvedMedia?.media_kind === "video" ? "video" : "image";

  return {
    caption: record.caption || "",
    id: record.id,
    identifier: record.id,
    imageSrc: resolveImage(record.media_assets, fallbackPublicGallery[0].imageSrc),
    mediaKind,
    secureUrl: resolvedMedia?.secure_url || fallbackPublicGallery[0].imageSrc,
    thumbnailUrl: resolvedMedia?.thumbnail_url || null,
    title: record.title,
  };
}

async function getPublishedPostByIdentifier(
  contentType: "blog" | "event",
  identifier: string
) {
  const normalizedIdentifier = normalizeIdentifier(identifier);

  if (!normalizedIdentifier) {
    return null;
  }

  const supabase = await createClient();

  const { data: bySlug } = await supabase
    .from("content_posts")
    .select(contentPostSelect)
    .eq("content_type", contentType)
    .eq("status", "published")
    .eq("slug", normalizedIdentifier)
    .maybeSingle();

  if (bySlug) {
    return bySlug as ContentPostRecord & {
      media_assets?: MediaAssetRecord | MediaAssetRecord[] | null;
    };
  }

  if (!isUuid(normalizedIdentifier)) {
    return null;
  }

  const { data: byId } = await supabase
    .from("content_posts")
    .select(contentPostSelect)
    .eq("content_type", contentType)
    .eq("status", "published")
    .eq("id", normalizedIdentifier)
    .maybeSingle();

  return (byId as
    | (ContentPostRecord & {
        media_assets?: MediaAssetRecord | MediaAssetRecord[] | null;
      })
    | null);
}

export const getPublishedBlogByIdentifier = cache(async (identifier: string) => {
  const record = await getPublishedPostByIdentifier("blog", identifier);
  return record ? mapBlogDetail(record) : null;
});

export const getPublishedEventByIdentifier = cache(async (identifier: string) => {
  const record = await getPublishedPostByIdentifier("event", identifier);
  return record ? mapEventDetail(record) : null;
});

export const getPublishedGalleryByIdentifier = cache(async (identifier: string) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);

  if (!normalizedIdentifier) {
    return null;
  }

  const supabase = await createClient();

  if (isUuid(normalizedIdentifier)) {
    const { data: byId } = await supabase
      .from("gallery_entries")
      .select(galleryEntrySelect)
      .eq("status", "published")
      .eq("id", normalizedIdentifier)
      .maybeSingle();

    if (byId) {
      return mapGalleryDetail(byId as GalleryEntryPublicRecord);
    }
  }

  const { data: publishedGallery } = await supabase
    .from("gallery_entries")
    .select(galleryEntrySelect)
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .limit(200);

  if (!publishedGallery?.length) {
    return null;
  }

  const matched = (publishedGallery as GalleryEntryPublicRecord[]).find((record) => {
    const titleSlug = slugifyValue(record.title);
    return titleSlug === normalizedIdentifier;
  });

  if (!matched) {
    return null;
  }

  return mapGalleryDetail(matched as GalleryEntryPublicRecord);
});

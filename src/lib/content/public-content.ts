import { cache } from "react";
import { brandProfile } from "@/lib/branding";
import type { Json, Tables } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";

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

type ContentPostRecord = Tables<"content_posts">;
type DeveloperProfileRecord = Tables<"developer_profiles">;
type GalleryEntryRecord = Tables<"gallery_entries">;
type MediaAssetRecord = Pick<
  Tables<"media_assets">,
  "alt_text" | "media_kind" | "secure_url" | "thumbnail_url" | "title"
>;

const fallbackBlogImage = "/images/home-group.jpg";
const fallbackEventImage = "/images/workshop.jpg";
const fallbackNoticeHref = "/notices";

export const fallbackAboutContent = {
  eyebrow: brandProfile.slogan,
  title: brandProfile.fullName,
  summary:
    `${brandProfile.fullName} (${brandProfile.shortName}) is the non-profit university IT club of ${brandProfile.university}, founded and registered on 11 Nov 2015 and approved by the University on 18 Nov 2015.`,
  story: [
    `${brandProfile.shortName} brings together students who want to learn, build, and lead through practical work in information technology.`,
    `From ${brandProfile.address}, the society runs programs, courses, workshops, certificates, and community activities that help students move forward with confidence.`,
  ],
  missionTitle: "What JnUITS stands for",
  missionPoints: [
    "Practical skill development through courses, workshops, seminars, and technical events.",
    "A collaborative community for technology-minded students at Jagannath University.",
    "Visible institutional trust through certificate verification, public communication, and durable digital operations.",
  ],
  values: [
    {
      title: "Practical learning",
      description:
        "Programs, workshops, and member work should produce real technical confidence and visible outcomes.",
    },
    {
      title: "Community growth",
      description:
        "The society grows by bringing students together around shared curiosity, teamwork, and peer support.",
    },
    {
      title: "Institutional trust",
      description:
        "Public communication, certificates, and member records should always feel official, clear, and trustworthy.",
    },
  ] satisfies AboutValue[],
  imageSrc: "/images/workshop.jpg",
};

export const fallbackPublicBlogs: BlogPreview[] = [
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

export const fallbackPublicEvents: EventPreview[] = [
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

export const fallbackPublicNotices: NoticePreview[] = [
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
    title:
      "Attachment handling remains phase-gated until media import rules are finalized",
    category: "Media",
    publishedAt: "2026-04-05",
    summary:
      "Legacy files and images are being normalized so future public delivery can preserve links without leaking private storage paths.",
    delivery: "Attachment migration queued",
  },
];

export const fallbackPublicGallery: GalleryPreview[] = [
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

export const fallbackDeveloperCredits = {
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
      const title = asString(record.title);
      const description = asString(record.description);

      if (!title || !description) {
        return null;
      }

      return { title, description };
    })
    .filter((entry): entry is AboutValue => Boolean(entry));

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
    story: asStringArray(body?.story, fallbackAboutContent.story),
    missionTitle: asString(body?.missionTitle, fallbackAboutContent.missionTitle),
    missionPoints: asStringArray(
      body?.missionPoints,
      fallbackAboutContent.missionPoints
    ),
    values: asAboutValues(body?.values, fallbackAboutContent.values),
    imageSrc: asString(body?.imageSrc, fallbackAboutContent.imageSrc),
  };
});

export const getPublishedBlogs = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_posts")
    .select(
      "slug, title, category, summary, excerpt, published_at, read_time, media_assets(secure_url, thumbnail_url, alt_text, title, media_kind)"
    )
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
    .select(
      "slug, title, category, summary, location, starts_at, ends_at, status, media_assets(secure_url, thumbnail_url, alt_text, title, media_kind)"
    )
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
    .select("title, caption, sort_order, media_assets(secure_url, thumbnail_url, alt_text, title, media_kind)")
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .limit(24);

  if (!data || data.length === 0) {
    return fallbackPublicGallery;
  }

  return data.map((record, index) => {
    const media = (
      record as GalleryEntryRecord & {
        media_assets?: MediaAssetRecord | MediaAssetRecord[] | null;
      }
    ).media_assets;

    return {
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

import { cache } from "react";
import type { Json } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";

export type HomeHeroSlide = {
  buttonLink: string;
  buttonText: string;
  description: string;
  imageSrc: string;
  title: string;
};

export type HomeActivity = {
  description: string;
  link: string;
  title: string;
};

export type HomeAchievement = {
  description: string;
  icon: string;
  title: string;
};

export type HomePageContent = {
  aboutSection: {
    buttonLink: string;
    buttonText: string;
    description: string;
    imageSrc: string;
    title: string;
  };
  achievements: HomeAchievement[];
  achievementsImageSrc: string;
  achievementsTitle: string;
  eyebrow: string;
  heroImageSrc: string;
  heroSlides: HomeHeroSlide[];
  recentActivities: HomeActivity[];
  recentActivitiesImageSrc: string;
  recentActivitiesTitle: string;
  summary: string;
  title: string;
};

export type ContactContent = {
  email: string;
  location: string;
  phone: string;
  socialLinks: Array<{ href: string; label: string }>;
  summary: string;
  title: string;
  university: string;
};

export type FooterContent = {
  email: string;
  location: string;
  subtitle: string;
  summary: string;
  title: string;
  university: string;
};

const fallbackHomePageContent: HomePageContent = {
  aboutSection: {
    buttonLink: "/about",
    buttonText: "Learn More",
    description:
      "JnUITS connects students, builders, and operators around practical digital work.",
    imageSrc: "/images/home-group.jpg",
    title: "Institutional profile",
  },
  achievements: [
    {
      description:
        "Certificates, identity, and public content are being rebuilt on safer foundations.",
      icon: "Shield",
      title: "Secure platform",
    },
    {
      description:
        "Membership, operators, and publishing no longer depend on a brittle proxy chain.",
      icon: "Users",
      title: "Unified workflow",
    },
    {
      description:
        "The public site, portal, and admin workspace now share a single delivery path.",
      icon: "Layers",
      title: "One stack",
    },
  ],
  achievementsImageSrc: "/images/home-group.jpg",
  achievementsTitle: "Migration milestones",
  eyebrow: "Unified public site, portal, and operator stack",
  heroImageSrc: "/images/home-group.jpg",
  heroSlides: [
    {
      buttonLink: "/certificates",
      buttonText: "Verify certificates",
      description:
        "One institutional home for the website, certificates, member identity, and internal operations.",
      imageSrc: "/images/home-group.jpg",
      title: "JnUITS digital rebuild",
    },
  ],
  recentActivities: [
    {
      description:
        "Certificate verification, member onboarding, and public content migration are all moving in the same release train.",
      link: "/certificates",
      title: "Execution lane",
    },
  ],
  recentActivitiesImageSrc: "/images/home-group.jpg",
  recentActivitiesTitle: "Current delivery readout",
  summary:
    "The project is no longer an empty shell, but it is still in active delivery. Secure foundations, certificates, and membership transition flows are already in place; content depth and richer operational tools are what come next.",
  title:
    "One institutional home for the website, certificates, member identity, and internal operations.",
};

const fallbackContactContent: ContactContent = {
  email: "support@jnuits.org.bd",
  location: "Jagannath University, Dhaka, Bangladesh",
  phone: "+880 1XXX-XXXXXX",
  socialLinks: [
    { href: "https://www.facebook.com/jnuitsbd", label: "Facebook" },
    { href: "https://www.linkedin.com", label: "LinkedIn" },
  ],
  summary:
    "Reach the JnUITS team without routing through the legacy proxy.",
  title: "Contact JnUITS",
  university: "Jagannath University IT Society (JnUITS)",
};

const fallbackFooterContent: FooterContent = {
  email: "support@jnuits.org.bd",
  location: "Jagannath University, Dhaka, Bangladesh",
  subtitle: "Unified website, portal, and operator stack",
  summary:
    "The platform foundation is live, but the content migration, richer portal workflows, and operator queues are still moving through the execution plan.",
  title: "JnUITS Full Stack",
  university: "Jagannath University IT Society (JnUITS)",
};

function asObject(value: Json | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : null;
}

function asString(value: Json | undefined, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asRecordArray(value: Json | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is Record<string, Json | undefined> =>
      Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
  );
}

function parseHomeHeroSlides(
  value: Json | undefined,
  fallback: HomeHeroSlide[]
) {
  const slides = asRecordArray(value)
    .map((entry) => ({
      buttonLink: asString(entry.buttonLink, fallback[0]?.buttonLink || "/"),
      buttonText: asString(entry.buttonText, fallback[0]?.buttonText || "Learn More"),
      description: asString(entry.description),
      imageSrc: asString(entry.imageSrc || entry.image, fallback[0]?.imageSrc || "/logo.svg"),
      title: asString(entry.title),
    }))
    .filter((entry) => entry.title && entry.description && entry.imageSrc);

  return slides.length > 0 ? slides : fallback;
}

function parseHomeActivities(
  value: Json | undefined,
  fallback: HomeActivity[]
) {
  const activities = asRecordArray(value)
    .map((entry) => ({
      description: asString(entry.description),
      link: asString(entry.link, "/"),
      title: asString(entry.title),
    }))
    .filter((entry) => entry.title && entry.description);

  return activities.length > 0 ? activities : fallback;
}

function parseHomeAchievements(
  value: Json | undefined,
  fallback: HomeAchievement[]
) {
  const achievements = asRecordArray(value)
    .map((entry) => ({
      description: asString(entry.description),
      icon: asString(entry.icon, "Sparkles"),
      title: asString(entry.title),
    }))
    .filter((entry) => entry.title && entry.description);

  return achievements.length > 0 ? achievements : fallback;
}

export const getHomePageContent = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_pages")
    .select("slug, title, eyebrow, summary, body")
    .eq("slug", "home")
    .eq("status", "published")
    .maybeSingle();

  if (!data) {
    return fallbackHomePageContent;
  }

  const body = asObject(data.body);
  const aboutSection = asObject(body?.aboutSection);
  const recentActivities = asObject(body?.recentActivities);
  const achievements = asObject(body?.achievements);
  const heroSlides = parseHomeHeroSlides(body?.heroSlides, fallbackHomePageContent.heroSlides);
  const heroImageSrc = heroSlides[0]?.imageSrc || fallbackHomePageContent.heroImageSrc;

  return {
    aboutSection: {
      buttonLink: asString(
        aboutSection?.buttonLink,
        fallbackHomePageContent.aboutSection.buttonLink
      ),
      buttonText: asString(
        aboutSection?.buttonText,
        fallbackHomePageContent.aboutSection.buttonText
      ),
      description: asString(
        aboutSection?.description,
        fallbackHomePageContent.aboutSection.description
      ),
      imageSrc: asString(
        aboutSection?.imageSrc,
        fallbackHomePageContent.aboutSection.imageSrc
      ),
      title: asString(
        aboutSection?.title,
        fallbackHomePageContent.aboutSection.title
      ),
    },
    achievements: parseHomeAchievements(
      achievements?.items,
      fallbackHomePageContent.achievements
    ),
    achievementsImageSrc: asString(
      achievements?.imageSrc,
      fallbackHomePageContent.achievementsImageSrc
    ),
    achievementsTitle: asString(
      achievements?.title,
      fallbackHomePageContent.achievementsTitle
    ),
    eyebrow: data.eyebrow || fallbackHomePageContent.eyebrow,
    heroImageSrc,
    heroSlides,
    recentActivities: parseHomeActivities(
      recentActivities?.activities,
      fallbackHomePageContent.recentActivities
    ),
    recentActivitiesImageSrc: asString(
      recentActivities?.imageSrc,
      fallbackHomePageContent.recentActivitiesImageSrc
    ),
    recentActivitiesTitle: asString(
      recentActivities?.title,
      fallbackHomePageContent.recentActivitiesTitle
    ),
    summary: data.summary || heroSlides[0]?.description || fallbackHomePageContent.summary,
    title: data.title || heroSlides[0]?.title || fallbackHomePageContent.title,
  } satisfies HomePageContent;
});

function normalizeSocialLinks(
  value: Json | undefined,
  fallback: ContactContent["socialLinks"]
) {
  const links = asRecordArray(value)
    .map((entry) => ({
      href: asString(entry.href),
      label: asString(entry.label),
    }))
    .filter((entry) => entry.href && entry.label);

  return links.length > 0 ? links : fallback;
}

export const getContactContent = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_pages")
    .select("slug, title, summary, body")
    .eq("slug", "contact")
    .eq("status", "published")
    .maybeSingle();

  if (!data) {
    return fallbackContactContent;
  }

  const body = asObject(data.body);

  return {
    email: asString(body?.email, fallbackContactContent.email),
    location: asString(body?.location, fallbackContactContent.location),
    phone: asString(body?.phone, fallbackContactContent.phone),
    socialLinks: normalizeSocialLinks(
      body?.socialLinks,
      fallbackContactContent.socialLinks
    ),
    summary: data.summary || fallbackContactContent.summary,
    title: data.title || fallbackContactContent.title,
    university: asString(body?.university, fallbackContactContent.university),
  } satisfies ContactContent;
});

export const getFooterContent = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_pages")
    .select("slug, title, summary, body")
    .eq("slug", "footer")
    .eq("status", "published")
    .maybeSingle();

  if (!data) {
    return fallbackFooterContent;
  }

  const body = asObject(data.body);

  return {
    email: asString(body?.email, fallbackFooterContent.email),
    location: asString(body?.location, fallbackFooterContent.location),
    subtitle: asString(body?.subtitle, fallbackFooterContent.subtitle),
    summary: data.summary || fallbackFooterContent.summary,
    title: data.title || fallbackFooterContent.title,
    university: asString(body?.university, fallbackFooterContent.university),
  } satisfies FooterContent;
});

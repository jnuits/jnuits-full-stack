import { cache } from "react";
import { brandProfile } from "@/lib/branding";
import type { Json } from "@/lib/db/types";
import { createPublicClient } from "@/lib/supabase/public";

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
  address: string;
  email: string;
  foundedLabel: string;
  googleBusinessHref: string;
  location: string;
  organizationType: string;
  phone: string;
  socialLinks: Array<{ href: string; label: string }>;
  summary: string;
  title: string;
  university: string;
};

export type FooterContent = {
  email: string;
  location: string;
  phone: string;
  subtitle: string;
  summary: string;
  title: string;
  university: string;
};

const fallbackHomePageContent: HomePageContent = {
  aboutSection: {
    buttonLink: "/about",
    buttonText: "About JnUITS",
    description:
      `${brandProfile.shortName} is the non-profit university IT club of ${brandProfile.university}, helping students build practical digital skills, community, and leadership.`,
    imageSrc: "/images/home-group.jpg",
    title: brandProfile.fullName,
  },
  achievements: [
    {
      description:
        "Founded and registered on 11 Nov 2015, then approved by the University on 18 Nov 2015, JnUITS continues to operate as a student-centered non-profit technology community.",
      icon: "Landmark",
      title: "Institutional continuity",
    },
    {
      description:
        "The society brings together workshops, competitions, certificates, publishing, and member operations in one reliable institutional platform.",
      icon: "Users",
      title: "Campus community",
    },
    {
      description:
        `${brandProfile.slogan} remains the core promise behind every program, course, event, and public activity.`,
      icon: "ArrowUpRight",
      title: "Step Ahead with IT",
    },
  ],
  achievementsImageSrc: "/images/home-group.jpg",
  achievementsTitle: "Institutional highlights",
  eyebrow: brandProfile.slogan,
  heroImageSrc: "/images/home-group.jpg",
  heroSlides: [
    {
      buttonLink: "/about",
      buttonText: "Learn more",
      description:
        `${brandProfile.slogan}. ${brandProfile.fullName} is a non-profit university IT club based at ${brandProfile.university}, Dhaka.`,
      imageSrc: "/images/home-group.jpg",
      title: brandProfile.fullName,
    },
  ],
  recentActivities: [
    {
      description:
        "Courses, certificate programs, workshops, and member development tracks continue to shape the public face of the society.",
      link: "/events",
      title: "Programs and activities",
    },
  ],
  recentActivitiesImageSrc: "/images/home-group.jpg",
  recentActivitiesTitle: "Current focus",
  summary:
    `${brandProfile.fullName} (${brandProfile.shortName}) is the official university IT club of ${brandProfile.university}, operating from ${brandProfile.address}.`,
  title: brandProfile.fullName,
};

const fallbackContactContent: ContactContent = {
  address: brandProfile.address,
  email: brandProfile.email,
  foundedLabel: brandProfile.foundedLabel,
  googleBusinessHref: brandProfile.googleBusinessHref,
  location: brandProfile.university,
  organizationType: brandProfile.type,
  phone: brandProfile.phone,
  socialLinks: [...brandProfile.socialLinks],
  summary:
    `Reach ${brandProfile.shortName} for programs, certificates, membership, collaborations, and public information.`,
  title: `Contact ${brandProfile.shortName}`,
  university: brandProfile.fullName,
};

const fallbackFooterContent: FooterContent = {
  email: brandProfile.email,
  location: brandProfile.address,
  phone: brandProfile.phone,
  subtitle: brandProfile.type,
  summary:
    `${brandProfile.slogan}. ${brandProfile.fullName} is the official university IT club of ${brandProfile.university}.`,
  title: brandProfile.fullName,
  university: brandProfile.fullName,
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
  const supabase = createPublicClient();
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
  const supabase = createPublicClient();
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
    address: asString(body?.address, fallbackContactContent.address),
    email: asString(body?.email, fallbackContactContent.email),
    foundedLabel: asString(body?.foundedLabel, fallbackContactContent.foundedLabel),
    googleBusinessHref: asString(
      body?.googleBusinessHref,
      fallbackContactContent.googleBusinessHref
    ),
    location: asString(body?.location, fallbackContactContent.location),
    organizationType: asString(
      body?.organizationType,
      fallbackContactContent.organizationType
    ),
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
  const supabase = createPublicClient();
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
    phone: asString(body?.phone, fallbackFooterContent.phone),
    subtitle: asString(body?.subtitle, fallbackFooterContent.subtitle),
    summary: data.summary || fallbackFooterContent.summary,
    title: data.title || fallbackFooterContent.title,
    university: asString(body?.university, fallbackFooterContent.university),
  } satisfies FooterContent;
});

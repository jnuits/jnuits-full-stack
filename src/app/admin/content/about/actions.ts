"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { setAdminFlash } from "@/lib/admin/flash";
import { requireAdminUser } from "@/lib/auth/session";
import {
  fallbackAboutContent,
  homepageContent,
} from "@/lib/content/public-content";
import type { Json } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";

const aboutContentSchema = z.object({
  heroBody: z.string().trim().min(1, "Hero body is required.").max(1200),
  heroHeading: z.string().trim().min(1, "Hero heading is required.").max(180),
  missionBody: z.string().trim().min(1, "Mission body is required.").max(1500),
  missionHeading: z.string().trim().min(1, "Mission heading is required.").max(120),
  visionBody: z.string().trim().min(1, "Vision body is required.").max(1500),
  visionHeading: z.string().trim().min(1, "Vision heading is required.").max(120),
});

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: Json | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

async function readAboutBody() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("content_pages")
    .select("body")
    .eq("slug", "about")
    .maybeSingle();

  return asRecord(data?.body as Json | null | undefined);
}

async function readHomeBody() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("content_pages")
    .select("body")
    .eq("slug", "home")
    .maybeSingle();

  return asRecord(data?.body as Json | null | undefined);
}

function buildStats(formData: FormData) {
  return {
    active_members:
      asString(formData.get("stat_active_members_value")) ||
      fallbackAboutContent.stats.active_members,
    alumni_community:
      asString(formData.get("stat_alumni_community_value")) ||
      fallbackAboutContent.stats.alumni_community,
    events_organized:
      asString(formData.get("stat_events_organized_value")) ||
      fallbackAboutContent.stats.events_organized,
    executive_terms:
      asString(formData.get("stat_executive_terms_value")) ||
      fallbackAboutContent.stats.executive_terms,
    years_active:
      asString(formData.get("stat_years_active_value")) ||
      fallbackAboutContent.stats.years_active,
  };
}

function buildPublicStats(stats: ReturnType<typeof buildStats>) {
  return [
    { value: stats.active_members, label: "Active members" },
    { value: stats.events_organized, label: "Events organized" },
    { value: stats.years_active, label: "Years active" },
    { value: stats.executive_terms, label: "Executive terms" },
    { value: stats.alumni_community, label: "Alumni & community" },
  ];
}

function buildTimeline(formData: FormData) {
  const dates = formData.getAll("timelineDate");
  const events = formData.getAll("timelineEvent");
  const deleteIndexes = new Set(
    formData
      .getAll("timelineDeleteIndex")
      .map((value) => Number(asString(value)))
      .filter((value) => Number.isInteger(value))
  );

  const timeline = dates
    .map((date, index) => ({
      date: asString(date),
      delete: deleteIndexes.has(index),
      event: asString(events[index] || null),
    }))
    .filter((entry) => !entry.delete && entry.date && entry.event)
    .map(({ date, event }) => ({ date, event }));

  return timeline.length > 0 ? timeline : fallbackAboutContent.timeline;
}

function buildCommunityReach(formData: FormData) {
  return fallbackAboutContent.communityReach.map((item, index) => ({
    ...item,
    label: asString(formData.get(`reach_${index}_label`)) || item.label,
    link: asString(formData.get(`reach_${index}_link`)) || null,
    stat: asString(formData.get(`reach_${index}_stat`)) || item.stat,
  }));
}

export async function saveAboutPageContent(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const parsed = aboutContentSchema.safeParse({
    heroBody: asString(formData.get("heroBody")),
    heroHeading: asString(formData.get("heroHeading")),
    missionBody: asString(formData.get("missionBody")),
    missionHeading: asString(formData.get("missionHeading")),
    visionBody: asString(formData.get("visionBody")),
    visionHeading: asString(formData.get("visionHeading")),
  });

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "About page not saved",
      message: parsed.error.issues[0]?.message || "Required About page fields are missing.",
    });
    redirect("/admin/content/about");
  }

  try {
    const admin = createAdminClient();
    const existingBody = await readAboutBody();
    const stats = buildStats(formData);
    const body = {
      ...existingBody,
      communityReach: buildCommunityReach(formData) as unknown as Json,
      communityReachCaption:
        asString(formData.get("communityReachCaption")) ||
        fallbackAboutContent.communityReachCaption,
      heroDescription: parsed.data.heroBody,
      missionStatement: parsed.data.missionBody,
      missionTitle: parsed.data.missionHeading,
      stats: stats as unknown as Json,
      timeline: buildTimeline(formData) as unknown as Json,
      vision: parsed.data.visionBody,
      visionTitle: parsed.data.visionHeading,
    };

    const { error } = await admin.from("content_pages").upsert(
      {
        body: body as Json,
        created_by_user_id: actorUserId,
        eyebrow: fallbackAboutContent.eyebrow,
        slug: "about",
        status: "published",
        summary: parsed.data.heroBody,
        title: parsed.data.heroHeading,
      },
      { onConflict: "slug" }
    );

    if (error) {
      throw new Error(error.message);
    }

    const publicStats = buildPublicStats(stats);
    const existingHomeBody = await readHomeBody();
    const { error: homeError } = await admin.from("content_pages").upsert(
      {
        body: {
          ...existingHomeBody,
          achievementBandStats: publicStats,
          stats: publicStats,
        } as unknown as Json,
        created_by_user_id: actorUserId,
        eyebrow: homepageContent.hero.eyebrow,
        slug: "home",
        status: "published",
        summary: homepageContent.hero.subheading,
        title: homepageContent.hero.heading,
      },
      { onConflict: "slug" }
    );

    if (homeError) {
      throw new Error(homeError.message);
    }

    revalidatePath("/");
    revalidatePath("/about");
    revalidatePath("/admin/content");
    revalidatePath("/admin/content/about");
    await setAdminFlash({
      tone: "success",
      title: "About page content saved",
      message: "The About page singleton content is now published.",
    });
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "About page not saved",
      message:
        error instanceof Error
          ? error.message
          : "The About page content could not be saved.",
    });
  }

  redirect("/admin/content/about");
}

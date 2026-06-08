"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  SafeAdminActionError,
  getSafeAdminActionErrorMessage,
} from "@/lib/admin/action-error";
import { setAdminFlash } from "@/lib/admin/flash";
import { requireAdminPermission } from "@/lib/auth/session";
import {
  EVENT_CATEGORIES,
  EVENT_DELIVERY_MODES,
  EVENT_LOCATION_MODES,
  EVENT_REGISTRATION_MODES,
  EVENT_STATUSES,
} from "@/lib/content/events";
import { insertAuditEvent } from "@/lib/content/media-assets";
import type { Json } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";

const statusSchema = z.enum(EVENT_STATUSES);
const categorySchema = z.enum(EVENT_CATEGORIES);
const deliveryModeSchema = z.enum(EVENT_DELIVERY_MODES);
const locationModeSchema = z.enum(EVENT_LOCATION_MODES);
const registrationModeSchema = z.enum(EVENT_REGISTRATION_MODES);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().default("");
const optionalInteger = (max = 1000000) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(1).max(max).optional()
  );
const booleanStringSchema = z
  .enum(["true", "false"])
  .optional()
  .default("false")
  .transform((value) => value === "true");

const eventFormSchema = z.object({
  bodyMarkdown: optionalText(200000),
  category: categorySchema,
  coverAltTextOverride: optionalText(300),
  coverMediaAssetId: optionalText(80),
  ctaLabel: optionalText(120),
  ctaUrl: optionalText(1000),
  deliveryMode: deliveryModeSchema,
  endsAtDate: optionalText(20),
  endsAtTime: optionalText(20),
  eventId: optionalText(80),
  locationLabel: optionalText(220),
  locationMode: locationModeSchema,
  onlineUrl: optionalText(1000),
  registrationClosesAtDate: optionalText(20),
  registrationClosesAtTime: optionalText(20),
  registrationMode: registrationModeSchema,
  registrationOpen: booleanStringSchema,
  registrationUrl: optionalText(1000),
  slug: optionalText(180),
  startsAtDate: z.string().trim().min(1, "Start date is required.").max(20),
  startsAtTime: optionalText(20),
  status: statusSchema.default("draft"),
  summary: z.string().trim().min(1, "Summary is required.").max(1000),
  timezone: z.string().trim().min(1, "Timezone is required.").max(120),
  title: z.string().trim().min(1, "Title is required.").max(220),
  venueAddress: optionalText(400),
  venueName: optionalText(220),
  capacity: optionalInteger(),
});

const lifecycleSchema = z.object({
  eventId: z.string().trim().min(1),
  intent: z.enum(["archive", "delete", "publish"]),
});

type ZonedParts = {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
};

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeEventError(error: unknown, context: string, fallback: string) {
  return getSafeAdminActionErrorMessage(error, {
    context: `content.events.${context}`,
    fallback,
  });
}

function pickFormFields(formData: FormData, fields: string[]) {
  return Object.fromEntries(fields.map((field) => [field, asString(formData.get(field))]));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 160);
}

function parseOptionalUrl(value: string, fieldName: string) {
  if (!value) {
    return null;
  }

  if (value.startsWith("/")) {
    return value;
  }

  try {
    return new URL(value).toString();
  } catch {
    throw new SafeAdminActionError(`${fieldName} must be a valid URL or internal path.`);
  }
}

function parseExternalUrl(value: string, fieldName: string) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).toString();
  } catch {
    throw new SafeAdminActionError(`${fieldName} must be a valid URL.`);
  }
}

function getFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const values = new Map<string, string>();

  for (const part of getFormatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") {
      values.set(part.type, part.value);
    }
  }

  return {
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
    month: Number(values.get("month")),
    second: Number(values.get("second")),
    year: Number(values.get("year")),
  };
}

function buildZonedIso(
  dateValue: string,
  timeValue: string,
  timeZone: string,
  fallbackTime: string
) {
  if (!dateValue) {
    return null;
  }

  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = (timeValue || fallbackTime).split(":").map(Number);

  if (
    !year ||
    !month ||
    !day ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    throw new SafeAdminActionError("Event date and time must be valid.");
  }

  const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utcGuess = desired;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getZonedParts(new Date(utcGuess), timeZone);
    const observed = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const diff = desired - observed;

    if (diff === 0) {
      break;
    }

    utcGuess += diff;
  }

  return new Date(utcGuess).toISOString();
}

async function audit(options: {
  action: string;
  actorUserId: string;
  entityId: string;
  entityType: string;
  metadata?: Json;
}) {
  await insertAuditEvent(createAdminClient(), options);
}

function revalidateEventPaths(eventId?: string, slug?: string) {
  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath("/admin/content/events");
  revalidatePath("/sitemap.xml");

  if (eventId) {
    revalidatePath(`/admin/content/events/${eventId}`);
  }

  if (slug) {
    revalidatePath(`/events/${slug}`);
  }
}

export async function saveEvent(formData: FormData) {
  const auth = await requireAdminPermission("cms.events.manage", {
    fallbackPath: "/admin/content/events",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const parsed = eventFormSchema.safeParse(
    pickFormFields(formData, [
      "bodyMarkdown",
      "category",
      "coverAltTextOverride",
      "coverMediaAssetId",
      "ctaLabel",
      "ctaUrl",
      "deliveryMode",
      "endsAtDate",
      "endsAtTime",
      "eventId",
      "locationLabel",
      "locationMode",
      "onlineUrl",
      "registrationClosesAtDate",
      "registrationClosesAtTime",
      "registrationMode",
      "registrationOpen",
      "registrationUrl",
      "slug",
      "startsAtDate",
      "startsAtTime",
      "status",
      "summary",
      "timezone",
      "title",
      "venueAddress",
      "venueName",
      "capacity",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Event not saved",
      message: parsed.error.issues[0]?.message || "Provide valid event details.",
    });
    redirect("/admin/content/events");
  }

  const admin = createAdminClient();
  const data = parsed.data;
  const eventId = data.eventId || null;
  const slug = slugify(data.slug || data.title);

  if (!slug) {
    await setAdminFlash({
      tone: "error",
      title: "Event not saved",
      message: "Title or slug must produce a valid public slug.",
    });
    redirect("/admin/content/events");
  }

  try {
    const existing = eventId
      ? await admin
          .from("events")
          .select("id, legacy_content_post_id, published_at, slug, status")
          .eq("id", eventId)
          .maybeSingle()
      : { data: null, error: null };

    if (existing.error) {
      throw existing.error;
    }

    const startsAt = buildZonedIso(
      data.startsAtDate,
      data.startsAtTime,
      data.timezone,
      "10:00"
    );
    const endsAt = data.endsAtDate
      ? buildZonedIso(
          data.endsAtDate,
          data.endsAtTime,
          data.timezone,
          data.startsAtTime || "18:00"
        )
      : null;
    const registrationClosesAt = data.registrationClosesAtDate
      ? buildZonedIso(
          data.registrationClosesAtDate,
          data.registrationClosesAtTime,
          data.timezone,
          "23:59"
        )
      : null;

    if (!startsAt) {
      throw new SafeAdminActionError("Event start date and time are required.");
    }

    if (endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
      throw new SafeAdminActionError("Event end date/time must be after the start date/time.");
    }

    const onlineUrl = parseExternalUrl(data.onlineUrl, "Online link");
    const registrationUrl = parseExternalUrl(
      data.registrationUrl,
      "Registration link"
    );
    const ctaUrl = parseOptionalUrl(data.ctaUrl, "CTA link");

    if (data.registrationMode === "external" && !registrationUrl) {
      throw new SafeAdminActionError("External registration requires a valid registration URL.");
    }

    if (data.locationMode === "online" && !onlineUrl) {
      throw new SafeAdminActionError("Online events require a valid meeting URL.");
    }

    if (data.locationMode === "venue" && !data.venueName && !data.locationLabel) {
      throw new SafeAdminActionError(
        "Venue-based events require a venue name or location label."
      );
    }

    const payload = {
      body_markdown: data.bodyMarkdown || null,
      category: data.category,
      cover_alt_text_override: data.coverAltTextOverride || null,
      cover_media_asset_id: data.coverMediaAssetId || null,
      cta_label: data.ctaLabel || null,
      cta_url: ctaUrl,
      delivery_mode: data.deliveryMode,
      ends_at: endsAt,
      location_label: data.locationLabel || null,
      location_mode: data.locationMode,
      online_url: onlineUrl,
      published_at:
        data.status === "published"
          ? existing.data?.published_at || new Date().toISOString()
          : existing.data?.published_at || null,
      registration_closes_at: registrationClosesAt,
      registration_mode: data.registrationMode,
      registration_open:
        data.registrationMode === "internal" ? data.registrationOpen : false,
      registration_url:
        data.registrationMode === "external" ? registrationUrl : null,
      slug,
      starts_at: startsAt,
      status: data.status,
      summary: data.summary,
      timezone: data.timezone,
      title: data.title,
      venue_address: data.venueAddress || null,
      venue_name: data.venueName || null,
      capacity:
        data.registrationMode === "internal" ? data.capacity || null : null,
    };

    const query = eventId
      ? admin.from("events").update(payload).eq("id", eventId).select("id, slug").single()
      : admin
          .from("events")
          .insert({
            ...payload,
            created_by_user_id: actorUserId,
            source: "manual",
            source_metadata: {
              source: "admin-editor",
            },
          })
          .select("id, slug")
          .single();

    const { data: saved, error } = await query;

    if (error) {
      if (error.code === "23505") {
        throw new SafeAdminActionError("An event with this slug already exists.");
      }

      throw error;
    }

    if (!saved) {
      throw new SafeAdminActionError("The event could not be saved.");
    }

    await audit({
      action: eventId ? "events.event_updated" : "events.event_created",
      actorUserId,
      entityId: saved.id,
      entityType: "event",
      metadata: {
        category: data.category,
        registrationMode: data.registrationMode,
        slug,
        status: data.status,
      },
    });

    revalidateEventPaths(saved.id, saved.slug);
    await setAdminFlash({
      tone: "success",
      title: "Event saved",
      message: `${data.title} is ready in the events workspace.`,
    });
    redirect(`/admin/content/events/${saved.id}`);
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Event not saved",
      message: safeEventError(error, "save", "The event could not be saved."),
    });
    redirect(eventId ? `/admin/content/events/${eventId}` : "/admin/content/events/new");
  }
}

export async function updateEventLifecycle(
  boundIntentOrFormData: "archive" | "delete" | "publish" | FormData,
  maybeFormData?: FormData
) {
  const auth = await requireAdminPermission("cms.events.manage", {
    fallbackPath: "/admin/content/events",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const boundIntent =
    typeof boundIntentOrFormData === "string" ? boundIntentOrFormData : null;
  const formData =
    boundIntentOrFormData instanceof FormData
      ? boundIntentOrFormData
      : maybeFormData;

  if (!formData) {
    await setAdminFlash({
      tone: "error",
      title: "Event action failed",
      message: "Choose a valid event action.",
    });
    redirect("/admin/content/events");
  }

  const parsed = lifecycleSchema.safeParse(
    {
      ...pickFormFields(formData, ["eventId", "intent"]),
      intent: boundIntent || asString(formData.get("intent")),
    }
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Event action failed",
      message: "Choose a valid event action.",
    });
    redirect("/admin/content/events");
  }

  const admin = createAdminClient();
  const { eventId, intent } = parsed.data;
  const { data: existing, error: existingError } = await admin
    .from("events")
    .select("id, published_at, slug, title, status")
    .eq("id", eventId)
    .maybeSingle();

  if (existingError || !existing) {
    await setAdminFlash({
      tone: "error",
      title: "Event action failed",
      message: existingError
        ? safeEventError(existingError, "loadLifecycle", "The event could not be loaded.")
        : "The event was not found.",
    });
    redirect("/admin/content/events");
  }

  try {
    if (intent === "delete") {
      const { error } = await admin.from("events").delete().eq("id", eventId);

      if (error) {
        throw error;
      }

      await audit({
        action: "events.event_deleted",
        actorUserId,
        entityId: eventId,
        entityType: "event",
        metadata: { slug: existing.slug },
      });

      revalidateEventPaths(undefined, existing.slug);
      await setAdminFlash({
        tone: "success",
        title: "Event deleted",
        message: `${existing.title} was removed from the events module.`,
      });
      redirect("/admin/content/events");
    }

    const nextStatus = intent === "publish" ? "published" : "archived";
    const { error } = await admin
      .from("events")
      .update({
        published_at:
          nextStatus === "published"
            ? existing.published_at || new Date().toISOString()
            : existing.published_at,
        status: nextStatus,
      })
      .eq("id", eventId);

    if (error) {
      throw error;
    }

    await audit({
      action: `events.event_${intent}`,
      actorUserId,
      entityId: eventId,
      entityType: "event",
      metadata: { slug: existing.slug, status: nextStatus },
    });

    revalidateEventPaths(eventId, existing.slug);
    await setAdminFlash({
      tone: "success",
      title: "Event updated",
      message: `${existing.title} was ${intent === "publish" ? "published" : "archived"}.`,
    });
    redirect("/admin/content/events");
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Event action failed",
      message: safeEventError(error, "lifecycle", "The event could not be updated."),
    });
    redirect("/admin/content/events");
  }
}

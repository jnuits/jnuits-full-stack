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
import { uploadNoticeAttachmentToCloudinary } from "@/lib/cloudinary/notices";
import { insertAuditEvent } from "@/lib/content/media-assets";
import { resolveNoticeForAdminMutation } from "@/lib/content/notices";
import type { Json } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeNoticeError(error: unknown, context: string, fallback: string) {
  return getSafeAdminActionErrorMessage(error, {
    context: `content.notices.${context}`,
    fallback,
  });
}

function pickFormFields(formData: FormData, fields: string[]) {
  return Object.fromEntries(
    fields.map((field) => [field, asString(formData.get(field))])
  );
}

function getUploadedNoticeAttachment(formData: FormData) {
  const value = formData.get("noticeAttachment");

  if (
    value &&
    typeof value === "object" &&
    "arrayBuffer" in value &&
    "size" in value &&
    typeof value.size === "number" &&
    value.size > 0
  ) {
    return value as File;
  }

  return null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 120);
}

function parseDateTime(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeOptionalUrl(value: string) {
  if (!value) {
    return "";
  }

  if (value.startsWith("/")) {
    return value;
  }

  try {
    return new URL(value).toString();
  } catch {
    throw new SafeAdminActionError("Related link must be a valid URL or internal path.");
  }
}

const noticeFormSchema = z.object({
  body: z.string().trim().max(100000).optional().default(""),
  category: z.string().trim().max(80).optional().default("Notice"),
  ctaHref: z.string().trim().max(1000).optional().default(""),
  noticeId: z.string().trim().max(80).optional().default(""),
  publishedAt: z.string().trim().max(80).optional().default(""),
  slug: z.string().trim().max(180).optional().default(""),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  summary: z.string().trim().max(1000).optional().default(""),
  title: z.string().trim().min(1, "Title is required.").max(220),
});

const noticeLifecycleSchema = z.object({
  intent: z.enum(["archive", "delete", "publish"]),
  noticeId: z.string().trim().min(1, "Notice ID is required.").max(80),
});

async function requireNoticeManager() {
  const auth = await requireAdminPermission("cms.notices.manage", {
    fallbackPath: "/admin/content/notices",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  return actorUserId;
}

async function recordNoticeAudit(options: {
  action: string;
  actorUserId: string;
  entityId: string;
  metadata?: Json;
}) {
  const payload: {
    action: string;
    actorUserId: string;
    entityId: string;
    entityType: string;
    metadata?: Json;
  } = {
    action: options.action,
    actorUserId: options.actorUserId,
    entityId: options.entityId,
    entityType: "content_post",
  };

  if (options.metadata !== undefined) {
    payload.metadata = options.metadata;
  }

  await insertAuditEvent(createAdminClient(), payload);
}

export async function saveNotice(formData: FormData) {
  const actorUserId = await requireNoticeManager();
  const parsed = noticeFormSchema.safeParse(
    pickFormFields(formData, [
      "body",
      "category",
      "ctaHref",
      "noticeId",
      "publishedAt",
      "slug",
      "status",
      "summary",
      "title",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Notice not saved",
      message:
        parsed.error.issues[0]?.message ||
        "Title, slug, summary, and status are required.",
    });
    redirect("/admin/content/notices");
  }

  const {
    body,
    category,
    noticeId,
    publishedAt,
    status,
    summary,
    title,
  } = parsed.data;
  const slug = slugify(parsed.data.slug || title);

  if (!slug) {
    await setAdminFlash({
      tone: "error",
      title: "Notice not saved",
      message: "Title or slug must produce a valid public slug.",
    });
    redirect("/admin/content/notices");
  }

  let ctaHref = "";

  try {
    ctaHref = normalizeOptionalUrl(parsed.data.ctaHref);
    const noticeAttachment = getUploadedNoticeAttachment(formData);

    if (noticeAttachment) {
      const uploaded = await uploadNoticeAttachmentToCloudinary(
        noticeAttachment,
        slug || title
      );
      ctaHref = uploaded.url;
    }
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Notice not saved",
      message: safeNoticeError(error, "validateLink", "The related link could not be validated."),
    });
    redirect(noticeId ? `/admin/content/notices/${noticeId}` : "/admin/content/notices/new");
  }

  const existingNotice = noticeId
    ? await resolveNoticeForAdminMutation(noticeId)
    : null;
  const resolvedPublishedAt =
    parseDateTime(publishedAt) ||
    (status === "published"
      ? existingNotice?.publishedAt || new Date().toISOString()
      : null);
  const admin = createAdminClient();
  let savedNoticeId = noticeId;

  try {
    const payload = {
      body: body || null,
      category: category || "Notice",
      content_type: "notice",
      created_by_user_id: actorUserId,
      cta_href: ctaHref || null,
      published_at: resolvedPublishedAt,
      slug,
      status,
      summary: summary || null,
      title,
      updated_at: new Date().toISOString(),
    };
    const query = noticeId
      ? admin
          .from("content_posts")
          .update(payload)
          .eq("id", noticeId)
          .eq("content_type", "notice")
          .select("id")
          .single()
      : admin.from("content_posts").insert(payload).select("id").single();
    const { data, error } = await query;

    if (error) {
      throw error;
    }

    if (!data) {
      throw new SafeAdminActionError("Unable to save the notice.");
    }

    savedNoticeId = data.id;

    await recordNoticeAudit({
      action: noticeId ? "content.notice_updated" : "content.notice_created",
      actorUserId,
      entityId: data.id,
      metadata: {
        slug,
        status,
      },
    });

    revalidatePath("/admin/content");
    revalidatePath("/admin/content/notices");
    revalidatePath("/notices");
    revalidatePath(`/notices/${slug}`);

    if (existingNotice?.slug && existingNotice.slug !== slug) {
      revalidatePath(`/notices/${existingNotice.slug}`);
    }

    await setAdminFlash({
      tone: "success",
      title: "Notice saved",
      message: `${title} has been saved in the public notices collection.`,
    });
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Notice not saved",
      message: safeNoticeError(error, "save", "The notice could not be saved."),
    });
    redirect(noticeId ? `/admin/content/notices/${noticeId}` : "/admin/content/notices/new");
  }

  redirect(`/admin/content/notices/${savedNoticeId}`);
}

export async function updateNoticeLifecycle(formData: FormData) {
  const actorUserId = await requireNoticeManager();
  const parsed = noticeLifecycleSchema.safeParse(
    pickFormFields(formData, ["intent", "noticeId"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Notice action failed",
      message:
        parsed.error.issues[0]?.message ||
        "The notice action could not be validated.",
    });
    redirect("/admin/content/notices");
  }

  const { intent, noticeId } = parsed.data;
  const notice = await resolveNoticeForAdminMutation(noticeId);

  if (!notice) {
    await setAdminFlash({
      tone: "error",
      title: "Notice action failed",
      message: "The selected notice could not be found.",
    });
    redirect("/admin/content/notices");
  }

  const admin = createAdminClient();
  let flashTitle = "Notice action completed";
  let flashMessage = `${notice.title} has been updated.`;

  try {
    if (intent === "delete") {
      const { error } = await admin
        .from("content_posts")
        .delete()
        .eq("id", notice.id)
        .eq("content_type", "notice");

      if (error) {
        throw error;
      }

      await recordNoticeAudit({
        action: "content.notice_deleted",
        actorUserId,
        entityId: notice.id,
        metadata: {
          slug: notice.slug,
        },
      });

      revalidatePath("/admin/content");
      revalidatePath("/admin/content/notices");
      revalidatePath("/notices");
      revalidatePath(`/notices/${notice.slug}`);
      flashTitle = "Notice deleted";
      flashMessage = `${notice.title} has been removed from the notices collection.`;
    } else {
      const now = new Date().toISOString();
      const status = intent === "publish" ? "published" : "archived";
      const { error } = await admin
        .from("content_posts")
        .update({
          published_at:
            intent === "publish" ? notice.publishedAt || now : notice.publishedAt,
          status,
          updated_at: now,
        })
        .eq("id", notice.id)
        .eq("content_type", "notice");

      if (error) {
        throw error;
      }

      await recordNoticeAudit({
        action:
          intent === "publish"
            ? "content.notice_published"
            : "content.notice_archived",
        actorUserId,
        entityId: notice.id,
        metadata: {
          slug: notice.slug,
          status,
        },
      });

      revalidatePath("/admin/content");
      revalidatePath("/admin/content/notices");
      revalidatePath("/notices");
      revalidatePath(`/notices/${notice.slug}`);
      flashTitle = intent === "publish" ? "Notice published" : "Notice archived";
      flashMessage =
        intent === "publish"
          ? `${notice.title} is now visible publicly.`
          : `${notice.title} has been hidden from the public notices page.`;
    }
    await setAdminFlash({
      tone: "success",
      title: flashTitle,
      message: flashMessage,
    });
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Notice action failed",
      message: safeNoticeError(error, "lifecycle", "The notice action could not be completed."),
    });
  }

  redirect("/admin/content/notices");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setAdminFlash } from "@/lib/admin/flash";
import { requireAdminUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: FormDataEntryValue | null) {
  return typeof value === "string" && value === "true";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function saveCommitteeTerm(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const termId = asString(formData.get("termId"));
  const title = asString(formData.get("title"));
  const slug = slugify(asString(formData.get("slug")) || title);
  const summary = asString(formData.get("summary"));
  const startsOn = asString(formData.get("startsOn"));
  const endsOn = asString(formData.get("endsOn"));
  const status = asString(formData.get("status")) || "draft";
  const isPublic = asBoolean(formData.get("isPublic"));

  if (!title || !slug || !startsOn) {
    await setAdminFlash({
      tone: "error",
      title: "Committee term not saved",
      message: "Title, slug, and start date are required.",
    });
    redirect("/admin/committee");
  }

  const payload = {
    created_by_user_id: actorUserId,
    ends_on: endsOn || null,
    is_public: isPublic,
    slug,
    starts_on: startsOn,
    status,
    summary: summary || null,
    title,
  };

  const query = termId
    ? admin.from("committee_terms").update(payload).eq("id", termId).select("id").single()
    : admin.from("committee_terms").insert(payload).select("id").single();

  const { data, error } = await query;

  if (error || !data) {
    await setAdminFlash({
      tone: "error",
      title: "Committee term not saved",
      message: error?.message || "Unable to save the committee term.",
    });
    redirect("/admin/committee");
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: termId ? "committee.term_updated" : "committee.term_created",
    entity_type: "committee_term",
    entity_id: data.id,
    metadata: {
      isPublic,
      slug,
      status,
      title,
    },
  });

  revalidatePath("/admin/committee");
  revalidatePath("/committee");
  await setAdminFlash({
    tone: "success",
    title: termId ? "Committee term updated" : "Committee term created",
    message: `${title} is now saved in the new committee model.`,
  });
  redirect("/admin/committee");
}

export async function saveCommitteeAssignment(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const assignmentId = asString(formData.get("assignmentId"));
  const bio = asString(formData.get("bio"));
  const displayName = asString(formData.get("displayName"));
  const endsOn = asString(formData.get("endsOn"));
  const memberId = asString(formData.get("memberId"));
  const roleId = asString(formData.get("roleId"));
  const sortOrder =
    Number.parseInt(asString(formData.get("sortOrder")) || "100", 10) || 100;
  const startsOn = asString(formData.get("startsOn"));
  const status = asString(formData.get("status")) || "active";
  const termId = asString(formData.get("termId"));

  if (!termId || !roleId) {
    await setAdminFlash({
      tone: "error",
      title: "Committee assignment not saved",
      message: "Select both a term and a role before saving an assignment.",
    });
    redirect("/admin/committee");
  }

  if (!memberId && !displayName) {
    await setAdminFlash({
      tone: "error",
      title: "Committee assignment not saved",
      message: "Provide either a linked member or a display name.",
    });
    redirect("/admin/committee");
  }

  const payload = {
    bio: bio || null,
    created_by_user_id: actorUserId,
    display_name: displayName || null,
    ends_on: endsOn || null,
    member_id: memberId || null,
    role_id: roleId,
    sort_order: sortOrder,
    starts_on: startsOn || null,
    status,
    term_id: termId,
  };

  const query = assignmentId
    ? admin
        .from("committee_assignments")
        .update(payload)
        .eq("id", assignmentId)
        .select("id")
        .single()
    : admin
        .from("committee_assignments")
        .insert(payload)
        .select("id")
        .single();

  const { data, error } = await query;

  if (error || !data) {
    await setAdminFlash({
      tone: "error",
      title: "Committee assignment not saved",
      message: error?.message || "Unable to save the committee assignment.",
    });
    redirect("/admin/committee");
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: assignmentId
      ? "committee.assignment_updated"
      : "committee.assignment_created",
    entity_type: "committee_assignment",
    entity_id: data.id,
    metadata: {
      memberId: memberId || null,
      roleId,
      status,
      termId,
    },
  });

  revalidatePath("/admin/committee");
  revalidatePath("/committee");
  await setAdminFlash({
    tone: "success",
    title: assignmentId
      ? "Committee assignment updated"
      : "Committee assignment created",
    message: "The committee roster change is now saved.",
  });
  redirect("/admin/committee");
}

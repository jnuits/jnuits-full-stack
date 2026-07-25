import { type NextRequest, NextResponse } from "next/server";

import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { logServerError } from "@/lib/errors/api-error";
import { canAccessFormStudioKind } from "@/lib/forms/form-studio-access";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

const MAX_ITEMS = 100;

type LinkableEventRow = {
  ends_at: null | string;
  id: string;
  registration_mode: string;
  starts_at: null | string;
  status: string;
  title: string;
};

/**
 * Backs the Form Studio event selector so an operator never has to paste an
 * event UUID. Only events that publish_form_version() would accept are
 * returned: internal registration mode and not archived.
 */
async function handleGet(request: NextRequest) {
  const permission = await requireAdminApiPermission("cms.forms.manage", {
    forbiddenMessage: "Only form managers can browse linkable events.",
    unauthenticatedMessage: "Sign in before browsing linkable events.",
  });
  if (permission.response) return permission.response;

  if (!canAccessFormStudioKind(permission.auth.roles, "event_registration")) {
    return NextResponse.json(
      { error: "You do not have permission to manage event registration forms." },
      { status: 403 }
    );
  }

  const query = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 100);
  const admin = asFlexibleClient(createAdminClient());

  try {
    let builder = admin
      .from("events")
      .select("id, title, starts_at, ends_at, status, registration_mode")
      .eq("registration_mode", "internal")
      .neq("status", "archived")
      .order("starts_at", { ascending: false });

    if (query) {
      builder = builder.ilike("title", `%${query.replace(/[%_,]/g, (value) => `\\${value}`)}%`);
    }

    const { data, error } = await builder.range(0, MAX_ITEMS - 1);
    if (error) throw error;

    return NextResponse.json(
      {
        items: ((data || []) as LinkableEventRow[]).map((event) => ({
          endsAt: event.ends_at,
          id: event.id,
          startsAt: event.starts_at,
          status: event.status,
          title: event.title,
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    logServerError("forms.admin.linkable_events", error);
    return NextResponse.json({ error: "Events could not be loaded." }, { status: 500 });
  }
}

export const GET = withApiGuard(handleGet, { requireAuth: true });

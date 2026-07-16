import { type NextRequest, NextResponse } from "next/server";
import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { resolveEventForAdminMutation } from "@/lib/content/events";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

type EventTarget = {
  id: string;
  legacyContentPostId: null | string;
};

type RegistrationStatus = "all" | "cancelled" | "checked-in" | "confirmed" | "waitlisted";

type RegistrationRow = {
  cancelled_at: null | string;
  checked_in_at: null | string;
  created_at: string;
  id: string;
  member_id: null | string;
  promoted_at: null | string;
  registration_code: string;
  registration_status: null | string;
  registrant_email: string;
  registrant_name: string;
  registrant_phone: null | string;
  waitlisted_at: null | string;
};

function getEventIdentifier(request: Request) {
  const segments = new URL(request.url).pathname.split("/");

  return segments[segments.indexOf("events") + 1] || "";
}

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value || fallback);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function parseStatus(value: string | null): RegistrationStatus {
  if (
    value === "cancelled" ||
    value === "checked-in" ||
    value === "confirmed" ||
    value === "waitlisted"
  ) {
    return value;
  }

  return "all";
}

function escapeIlike(value: string) {
  return value.replace(/[\\%_,().]/g, (character) => `\\${character}`);
}

function eventFilter(event: EventTarget) {
  if (event.legacyContentPostId) {
    return `or(event_id.eq.${event.id},event_post_id.eq.${event.legacyContentPostId})`;
  }

  return `event_id.eq.${event.id}`;
}

function applyEventScope<T extends { or: (filter: string) => T }>(
  query: T,
  event: EventTarget
) {
  return query.or(eventFilter(event));
}

function applyStatusFilter<T extends {
  eq: (column: string, value: string) => T;
  is: (column: string, value: null) => T;
  not: (column: string, operator: string, value: null) => T;
}>(query: T, status: RegistrationStatus) {
  if (status === "confirmed") {
    return query.eq("registration_status", "confirmed").is("cancelled_at", null);
  }

  if (status === "waitlisted") {
    return query.eq("registration_status", "waitlisted").is("cancelled_at", null);
  }

  if (status === "checked-in") {
    return query.not("checked_in_at", "is", null).is("cancelled_at", null);
  }

  if (status === "cancelled") {
    return query.not("cancelled_at", "is", null);
  }

  return query;
}

async function countRows(
  admin: ReturnType<typeof asFlexibleClient>,
  event: EventTarget,
  status: Exclude<RegistrationStatus, "all">
) {
  let query = applyEventScope(
    admin
      .from("event_registrations")
      .select("id", { count: "exact", head: true }),
    event
  );

  query = applyStatusFilter(query, status);
  const { count, error } = await query;

  if (error) {
    throw new Error("Event registration aggregate lookup failed.");
  }

  return count || 0;
}

async function handleGet(request: NextRequest) {
  const permission = await requireAdminApiPermission("cms.events.manage", {
    forbiddenMessage: "Only event managers can view event registrations.",
    unauthenticatedMessage: "Sign in before viewing event registrations.",
  });

  if (permission.response) {
    return permission.response;
  }

  const eventIdentifier = getEventIdentifier(request);
  const event = await resolveEventForAdminMutation(eventIdentifier);

  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1, 100_000);
  const pageSize = parsePositiveInt(
    url.searchParams.get("pageSize"),
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
  );
  const status = parseStatus(url.searchParams.get("status"));
  const search = (url.searchParams.get("q") || "").trim().slice(0, 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const admin = asFlexibleClient(createAdminClient());

  let query = admin
    .from("event_registrations")
    .select(
      "id, member_id, registrant_name, registrant_email, registrant_phone, registration_code, registration_status, checked_in_at, cancelled_at, waitlisted_at, promoted_at, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (search) {
    const pattern = `%${escapeIlike(search)}%`;
    const searchFilter = `or(registrant_name.ilike.${pattern},registrant_email.ilike.${pattern},registration_code.ilike.${pattern})`;

    query = query.or(`and(${eventFilter(event)},${searchFilter})`);
  } else {
    query = applyEventScope(query, event);
  }

  query = applyStatusFilter(query, status);

  const [listResult, confirmed, waitlisted, checkedIn, cancelled] = await Promise.all([
    query.range(from, to),
    countRows(admin, event, "confirmed"),
    countRows(admin, event, "waitlisted"),
    countRows(admin, event, "checked-in"),
    countRows(admin, event, "cancelled"),
  ]);

  if (listResult.error) {
    return NextResponse.json(
      { error: "Event registrations could not be loaded." },
      { status: 500 }
    );
  }

  const rows = (listResult.data || []) as unknown as RegistrationRow[];
  const totalItems = listResult.count || 0;

  return NextResponse.json({
    items: rows.map((row) => ({
      cancelledAt: row.cancelled_at,
      checkedInAt: row.checked_in_at,
      code: row.registration_code,
      createdAt: row.created_at,
      email: row.registrant_email,
      id: row.id,
      memberId: row.member_id,
      name: row.registrant_name,
      phone: row.registrant_phone,
      promotedAt: row.promoted_at,
      status:
        row.registration_status || (row.cancelled_at ? "cancelled" : "confirmed"),
      waitlistedAt: row.waitlisted_at,
    })),
    metrics: {
      cancelled,
      checkedIn,
      confirmed,
      waitlisted,
    },
    page,
    pageSize,
    status,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
  });
}

export const GET = withApiGuard(handleGet, { requireAuth: true });

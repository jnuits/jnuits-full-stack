"use server";

import * as Sentry from "@sentry/nextjs";
import { redirect } from "next/navigation";
import { setAdminFlash } from "@/lib/admin/flash";
import { getSafeAdminActionErrorMessage } from "@/lib/admin/action-error";
import { buildOperationalSnapshot } from "@/lib/admin/reports";
import { requireAdminPermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

async function persistReport(options: {
  reportType:
    | "membership_overview"
    | "committee_roster"
    | "content_inventory"
    | "reconciliation_snapshot"
    | "workplace_moderation";
  summary: string;
  title: string;
}) {
  const auth = await requireAdminPermission("admin.reports.read", {
    fallbackPath: "/admin/reports",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const snapshot = await buildOperationalSnapshot(admin);

  const { data, error } = await admin
    .from("operator_reports")
    .insert({
      created_by_user_id: actorUserId,
      report: snapshot,
      report_type: options.reportType,
      status: "completed",
      summary: options.summary,
      title: options.title,
    })
    .select("id")
    .single();

  if (error || !data) {
    await setAdminFlash({
      tone: "error",
      title: "Report generation failed",
      message: getSafeAdminActionErrorMessage(error, {
        context: "reports.persist",
        fallback: "The operator report could not be saved.",
      }),
    });
    redirect("/admin/reports");
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "operator.report_generated",
    entity_type: "operator_report",
    entity_id: data.id,
    metadata: {
      reportType: options.reportType,
      summary: options.summary,
    },
  });

  await setAdminFlash({
    tone: "success",
    title: "Report snapshot saved",
    message: `${options.title} is now stored in the operator report log.`,
  });

  redirect("/admin/reports");
}

export async function generateMembershipOverviewReport() {
  await persistReport({
    reportType: "membership_overview",
    summary: "Membership queues, invitations, and profile moderation counts.",
    title: "Membership operations overview",
  });
}

export async function generateCommitteeRosterReport() {
  await persistReport({
    reportType: "committee_roster",
    summary: "Committee term and assignment coverage across the new stack.",
    title: "Committee roster snapshot",
  });
}

export async function generateContentInventoryReport() {
  await persistReport({
    reportType: "content_inventory",
    summary: "Published public content, media inventory, and remaining parity gap.",
    title: "Public content inventory",
  });
}

export async function generateReconciliationSnapshot() {
  await persistReport({
    reportType: "reconciliation_snapshot",
    summary: "Cross-phase reconciliation snapshot for migration planning and operator review.",
    title: "Unified reconciliation snapshot",
  });
}

export async function triggerSentryVerificationReport() {
  const auth = await requireAdminPermission("admin.reports.read", {
    fallbackPath: "/admin/reports",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Freports");
  }

  const admin = createAdminClient();
  const triggeredAt = new Date().toISOString();
  const eventId = Sentry.captureMessage(
    `Operator verification event from /admin/reports at ${triggeredAt}`,
    {
      level: "info",
      tags: {
        environment: process.env.NODE_ENV || "unknown",
        source: "admin_reports",
        verification: "operator_manual",
      },
    }
  );

  await Sentry.flush(2_500);

  await admin.from("operator_reports").insert({
    created_by_user_id: actorUserId,
    report: {
      eventId,
      runtime: process.env.NODE_ENV || "unknown",
      triggeredAt,
      triggerType: "operator_safe_manual_verification",
    },
    report_type: "reconciliation_snapshot",
    status: "completed",
    summary:
      "Operator-triggered Sentry verification event emitted from protected admin workspace.",
    title: "Sentry verification event",
  });

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "observability.sentry_verification_triggered",
    entity_type: "sentry_event",
    entity_id: eventId || null,
    metadata: {
      runtime: process.env.NODE_ENV || "unknown",
      triggeredAt,
    },
  });

  await setAdminFlash({
    tone: "success",
    title: "Sentry verification event sent",
    message: eventId
      ? `Sentry event ${eventId} has been sent from the protected operator flow.`
      : "Sentry event has been sent from the protected operator flow.",
  });

  redirect("/admin/reports");
}

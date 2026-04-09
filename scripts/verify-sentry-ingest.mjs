#!/usr/bin/env node

import crypto from "node:crypto";
import process from "node:process";
import {
  buildSupabaseAdminClient,
  resolveReportPath,
  writeJsonReport,
} from "./lib/legacy-content.mjs";

function parseDsn(value) {
  const parsed = new URL(value);
  const projectId = parsed.pathname.replace(/^\/+/, "");
  const publicKey = parsed.username;

  if (!projectId || !publicKey) {
    throw new Error("Invalid Sentry DSN.");
  }

  return {
    endpoint: `https://${parsed.host}/api/${projectId}/envelope/`,
    projectId,
    publicKey,
  };
}

function buildEnvelope({
  dsn,
  eventId,
  message,
}) {
  const sentAt = new Date().toISOString();
  const header = {
    dsn,
    event_id: eventId,
    sent_at: sentAt,
  };
  const itemHeader = { type: "event" };
  const event = {
    event_id: eventId,
    level: "info",
    logger: "ops.sentry.verify",
    message,
    platform: "javascript",
    timestamp: Math.floor(Date.now() / 1000),
  };

  return `${JSON.stringify(header)}\n${JSON.stringify(itemHeader)}\n${JSON.stringify(event)}\n`;
}

async function main() {
  const dsn =
    process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

  if (!dsn) {
    throw new Error("SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN is required.");
  }

  const parsed = parseDsn(dsn);
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const message = `Operator verification event (${new Date().toISOString()})`;
  const envelope = buildEnvelope({
    dsn,
    eventId,
    message,
  });

  const response = await fetch(parsed.endpoint, {
    body: envelope,
    headers: {
      "Content-Type": "application/x-sentry-envelope",
    },
    method: "POST",
  });

  const bodyText = await response.text();
  const accepted = response.status >= 200 && response.status < 300;

  const report = {
    dsnProjectId: parsed.projectId,
    eventId,
    generatedAt: new Date().toISOString(),
    message,
    status: {
      accepted,
      responseBodySnippet: bodyText.slice(0, 250),
      statusCode: response.status,
    },
  };

  const reportPath = resolveReportPath(
    "rehearsal",
    "sentry-ingest-verification-report"
  );
  writeJsonReport(reportPath, report);

  const admin = buildSupabaseAdminClient();
  await admin.from("operator_reports").insert({
    report,
    report_type: "reconciliation_snapshot",
    status: accepted ? "completed" : "warning",
    summary: accepted
      ? "Sentry DSN ingest accepted verification envelope."
      : "Sentry DSN ingest verification failed.",
    title: "Sentry ingest verification",
  });

  console.log(
    JSON.stringify(
      {
        accepted,
        reportPath,
        statusCode: response.status,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        error:
          error instanceof Error ? error.message : "Unknown sentry verify error",
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});

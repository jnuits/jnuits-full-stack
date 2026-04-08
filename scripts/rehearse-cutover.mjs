#!/usr/bin/env node

import process from "node:process";
import {
  buildSupabaseAdminClient,
  resolveReportPath,
  writeJsonReport,
} from "./lib/legacy-content.mjs";

function parseArgs(argv) {
  const options = {
    report: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--report" && argv[index + 1]) {
      options.report = argv[index + 1];
      index += 1;
    }
    if (token.startsWith("--report=")) {
      options.report = token.split("=")[1] || "";
    }
  }

  return options;
}

async function countRows(supabase, table, options = {}) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });

  for (const [field, value] of Object.entries(options.equals || {})) {
    query = query.eq(field, value);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count || 0;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const reportPath = resolveReportPath(
    "rehearsal",
    "cutover-rehearsal-report",
    options.report
  );
  const supabase = buildSupabaseAdminClient();

  const [
    certificatesCount,
    latestCertificateBatchResult,
    pagesCount,
    publishedPostsCount,
    galleryCount,
    developerCount,
    mediaAssetCount,
    committeeTermsResult,
    committeeAssignmentsCount,
    membershipApplicationsPending,
    workplacePending,
    profilePending,
    submittedBlogsResult,
    draftBlogsCount,
    publishedBlogsCount,
  ] = await Promise.all([
    countRows(supabase, "certificates"),
    supabase
      .from("certificate_import_batches")
      .select(
        "id, source_name, status, inserted_count, updated_count, rejected_count, finished_at"
      )
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    countRows(supabase, "content_pages", { equals: { status: "published" } }),
    countRows(supabase, "content_posts", { equals: { status: "published" } }),
    countRows(supabase, "gallery_entries", { equals: { status: "published" } }),
    countRows(supabase, "developer_profiles", { equals: { status: "published" } }),
    countRows(supabase, "media_assets", { equals: { is_public: true } }),
    supabase
      .from("committee_terms")
      .select("id, slug, title, status, starts_on, ends_on")
      .order("starts_on", { ascending: false }),
    countRows(supabase, "committee_assignments"),
    countRows(supabase, "membership_applications", {
      equals: { status: "pending" },
    }),
    countRows(supabase, "member_requests", {
      equals: { request_type: "workplace_update", status: "pending" },
    }),
    countRows(supabase, "member_requests", {
      equals: { request_type: "profile_change", status: "pending" },
    }),
    supabase
      .from("content_posts")
      .select("id, title, slug, submitted_at, author_member_id")
      .eq("content_type", "blog")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true })
      .limit(10),
    countRows(supabase, "content_posts", {
      equals: { content_type: "blog", status: "draft" },
    }),
    countRows(supabase, "content_posts", {
      equals: { content_type: "blog", status: "published" },
    }),
  ]);

  if (latestCertificateBatchResult.error) {
    throw new Error(latestCertificateBatchResult.error.message);
  }

  if (committeeTermsResult.error) {
    throw new Error(committeeTermsResult.error.message);
  }

  if (submittedBlogsResult.error) {
    throw new Error(submittedBlogsResult.error.message);
  }

  const latestCertificateBatch = latestCertificateBatchResult.data || null;
  const committeeTerms = committeeTermsResult.data || [];
  const submittedBlogs = submittedBlogsResult.data || [];
  const activeCommitteeTerm =
    committeeTerms.find((term) => term.status === "active") || null;
  const upcomingCommitteeTerm =
    committeeTerms.find((term) => term.status === "upcoming") || null;

  const readiness = {
    certificatesImported:
      certificatesCount >= 135 &&
      latestCertificateBatch?.status === "completed" &&
      latestCertificateBatch?.rejected_count === 0,
    committeeSeeded: committeeTerms.length > 0 && committeeAssignmentsCount > 0,
    memberAuthoringReviewed:
      publishedBlogsCount > 0 && submittedBlogs.length === 0,
    publicContentImported:
      pagesCount >= 4 &&
      publishedPostsCount >= 4 &&
      galleryCount >= 4 &&
      developerCount >= 2 &&
      mediaAssetCount >= 8,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    readiness: {
      ...readiness,
      readyForCutover:
        readiness.certificatesImported &&
        readiness.committeeSeeded &&
        readiness.publicContentImported,
    },
    certificates: {
      count: certificatesCount,
      latestBatch: latestCertificateBatch,
    },
    publicContent: {
      developerProfilesPublished: developerCount,
      galleryPublished: galleryCount,
      mediaAssetsPublic: mediaAssetCount,
      pagesPublished: pagesCount,
      postsPublished: publishedPostsCount,
    },
    committee: {
      activeCommitteeTerm,
      assignmentsCount: committeeAssignmentsCount,
      totalTerms: committeeTerms.length,
      upcomingCommitteeTerm,
    },
    moderation: {
      membershipApplicationsPending,
      profileChangePending: profilePending,
      workplaceUpdatePending: workplacePending,
    },
    memberAuthoring: {
      draftBlogsCount,
      publishedBlogsCount,
      submittedBlogs,
      submittedQueueCount: submittedBlogs.length,
    },
  };

  await supabase.from("operator_reports").insert({
    report,
    report_type: "reconciliation_snapshot",
    status: "completed",
    summary:
      "Cutover rehearsal snapshot covering certificates, public content, committee data, moderation queues, and member authoring.",
    title: "Cutover rehearsal snapshot",
  });

  writeJsonReport(reportPath, report);

  console.log("");
  console.log("Cutover rehearsal report generated.");
  console.log(`Report: ${reportPath}`);
  console.log(`Certificates imported: ${report.readiness.certificatesImported}`);
  console.log(`Public content imported: ${report.readiness.publicContentImported}`);
  console.log(`Committee seeded: ${report.readiness.committeeSeeded}`);
  console.log(`Member authoring reviewed: ${report.readiness.memberAuthoringReviewed}`);
  console.log(`Ready for cutover: ${report.readiness.readyForCutover}`);
}

main().catch((error) => {
  console.error("Cutover rehearsal failed.");
  console.error(String(error));
  process.exitCode = 1;
});

#!/usr/bin/env node

import process from "node:process";
import {
  buildSupabaseAdminClient,
  getCloudinaryConfig,
  resolveReportPath,
  writeJsonReport,
} from "./lib/legacy-content.mjs";

function parseArgs(argv) {
  const options = {
    folder: "jnuits/jnuits-full-stack",
    report: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--folder" && argv[index + 1]) {
      options.folder = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === "--report" && argv[index + 1]) {
      options.report = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith("--folder=")) {
      options.folder = token.split("=")[1] || options.folder;
      continue;
    }

    if (token.startsWith("--report=")) {
      options.report = token.split("=")[1] || "";
    }
  }

  return options;
}

function buildBasicAuth(apiKey, apiSecret) {
  const value = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  return `Basic ${value}`;
}

async function fetchCloudinaryFolderResources(folder) {
  const cloudinary = getCloudinaryConfig();
  const authHeader = buildBasicAuth(cloudinary.apiKey, cloudinary.apiSecret);
  const resources = [];
  let nextCursor = null;

  while (true) {
    const body = {
      expression: `folder="${folder}"`,
      max_results: 200,
      next_cursor: nextCursor || undefined,
      with_field: ["context", "metadata"],
    };

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/resources/search`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        `Cloudinary resource search failed: ${payload?.error?.message || response.statusText}`
      );
    }

    resources.push(...(payload?.resources || []));
    nextCursor = payload?.next_cursor || null;

    if (!nextCursor) {
      break;
    }
  }

  return resources;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const supabase = buildSupabaseAdminClient();
  const reportPath = resolveReportPath(
    "rehearsal",
    "cloudinary-validation-report",
    options.report
  );

  const [cloudinaryResources, mediaAssetsResult] = await Promise.all([
    fetchCloudinaryFolderResources(options.folder),
    supabase
      .from("media_assets")
      .select("id, public_id, secure_url, media_kind, is_public, created_at")
      .eq("provider", "cloudinary")
      .eq("is_public", true),
  ]);

  if (mediaAssetsResult.error) {
    throw new Error(mediaAssetsResult.error.message);
  }

  const mediaAssets = mediaAssetsResult.data || [];
  const cloudinaryByPublicId = new Map(
    cloudinaryResources.map((resource) => [resource.public_id, resource])
  );
  const supabaseByPublicId = new Map(mediaAssets.map((asset) => [asset.public_id, asset]));

  const missingInCloudinary = [];
  const urlMismatch = [];

  for (const asset of mediaAssets) {
    const resource = cloudinaryByPublicId.get(asset.public_id);

    if (!resource) {
      missingInCloudinary.push({
        assetId: asset.id,
        mediaKind: asset.media_kind,
        publicId: asset.public_id,
      });
      continue;
    }

    if (
      typeof resource.secure_url === "string" &&
      typeof asset.secure_url === "string" &&
      resource.secure_url !== asset.secure_url
    ) {
      urlMismatch.push({
        assetId: asset.id,
        cloudinarySecureUrl: resource.secure_url,
        publicId: asset.public_id,
        supabaseSecureUrl: asset.secure_url,
      });
    }
  }

  const untrackedInSupabase = [];

  for (const resource of cloudinaryResources) {
    if (!supabaseByPublicId.has(resource.public_id)) {
      untrackedInSupabase.push({
        bytes: resource.bytes,
        folder: resource.asset_folder || resource.folder || null,
        publicId: resource.public_id,
        resourceType: resource.resource_type,
        secureUrl: resource.secure_url,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    folder: options.folder,
    summary: {
      cloudinaryResourceCount: cloudinaryResources.length,
      missingInCloudinaryCount: missingInCloudinary.length,
      supabaseAssetCount: mediaAssets.length,
      untrackedInSupabaseCount: untrackedInSupabase.length,
      urlMismatchCount: urlMismatch.length,
    },
    missingInCloudinary,
    untrackedInSupabase,
    urlMismatch,
  };

  writeJsonReport(reportPath, report);

  await supabase.from("operator_reports").insert({
    report,
    report_type: "content_inventory",
    status: "completed",
    summary:
      "Cloudinary folder validation for public media assets and Supabase metadata parity.",
    title: "Cloudinary validation snapshot",
  });

  console.log("");
  console.log("Cloudinary validation report generated.");
  console.log(`Report: ${reportPath}`);
  console.log(
    `Summary: ${report.summary.supabaseAssetCount} tracked, ${report.summary.cloudinaryResourceCount} in folder, ${report.summary.missingInCloudinaryCount} missing, ${report.summary.untrackedInSupabaseCount} untracked`
  );
}

main().catch((error) => {
  console.error("Cloudinary validation failed.");
  console.error(String(error));
  process.exitCode = 1;
});

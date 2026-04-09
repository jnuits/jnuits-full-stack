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
    apply: false,
    folder: "jnuits/jnuits-full-stack",
    report: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--apply") {
      options.apply = true;
      continue;
    }

    if (token === "--dry-run") {
      options.apply = false;
      continue;
    }

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
  }

  return options;
}

function buildBasicAuth(apiKey, apiSecret) {
  const value = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  return `Basic ${value}`;
}

function normalizeFolder(value) {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function basename(publicId) {
  const normalized = String(publicId || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

async function renameCloudinaryAsset({
  authHeader,
  cloudName,
  fromPublicId,
  resourceType,
  toPublicId,
}) {
  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/rename`;
  const body = new URLSearchParams({
    from_public_id: fromPublicId,
    invalidate: "true",
    overwrite: "false",
    to_public_id: toPublicId,
  });

  const response = await fetch(endpoint, {
    body: body.toString(),
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      payload,
      status: response.status,
    };
  }

  return {
    ok: true,
    payload,
    status: response.status,
  };
}

function buildTargetPublicId({
  assetId,
  folder,
  originalPublicId,
  reserved,
}) {
  const fileBase = basename(originalPublicId).toLowerCase();
  let candidate = `${folder}/${fileBase}`;

  if (!reserved.has(candidate)) {
    reserved.add(candidate);
    return candidate;
  }

  const withSuffix = `${folder}/${fileBase}-${String(assetId).slice(0, 8)}`;
  reserved.add(withSuffix);
  return withSuffix;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const folder = normalizeFolder(options.folder);
  const admin = buildSupabaseAdminClient();
  const cloudinary = getCloudinaryConfig();
  const authHeader = buildBasicAuth(cloudinary.apiKey, cloudinary.apiSecret);

  if (!folder) {
    throw new Error("Target Cloudinary folder is required.");
  }

  const { data: assets, error: assetsError } = await admin
    .from("media_assets")
    .select(
      "id, public_id, resource_type, secure_url, thumbnail_url, provider, is_public"
    )
    .eq("provider", "cloudinary")
    .eq("is_public", true)
    .order("created_at", { ascending: true });

  if (assetsError) {
    throw new Error(assetsError.message);
  }

  const rows = assets || [];
  const reserved = new Set(
    rows
      .map((row) => String(row.public_id || "").trim())
      .filter(Boolean)
      .filter((value) => value.startsWith(`${folder}/`))
  );

  const resultRows = [];
  let movedCount = 0;
  let alreadyInFolderCount = 0;
  let failedCount = 0;

  for (const row of rows) {
    const currentPublicId = String(row.public_id || "").trim();

    if (!currentPublicId) {
      failedCount += 1;
      resultRows.push({
        action: "skip_missing_public_id",
        assetId: row.id,
      });
      continue;
    }

    if (currentPublicId.startsWith(`${folder}/`)) {
      alreadyInFolderCount += 1;
      resultRows.push({
        action: "already_in_target_folder",
        assetId: row.id,
        publicId: currentPublicId,
      });
      continue;
    }

    const targetPublicId = buildTargetPublicId({
      assetId: row.id,
      folder,
      originalPublicId: currentPublicId,
      reserved,
    });

    if (!options.apply) {
      resultRows.push({
        action: "planned_move",
        assetId: row.id,
        from: currentPublicId,
        to: targetPublicId,
      });
      continue;
    }

    const renameResult = await renameCloudinaryAsset({
      authHeader,
      cloudName: cloudinary.cloudName,
      fromPublicId: currentPublicId,
      resourceType: row.resource_type || "image",
      toPublicId: targetPublicId,
    });

    if (!renameResult.ok || !renameResult.payload?.public_id) {
      failedCount += 1;
      resultRows.push({
        action: "move_failed",
        assetId: row.id,
        from: currentPublicId,
        reason:
          renameResult.payload?.error?.message ||
          renameResult.payload?.message ||
          `HTTP ${renameResult.status}`,
        status: renameResult.status,
        to: targetPublicId,
      });
      continue;
    }

    const secureUrl = renameResult.payload.secure_url || row.secure_url || null;
    const thumbnailUrl =
      renameResult.payload.secure_url || row.thumbnail_url || row.secure_url || null;

    const { error: updateError } = await admin
      .from("media_assets")
      .update({
        public_id: renameResult.payload.public_id,
        secure_url: secureUrl,
        thumbnail_url: thumbnailUrl,
      })
      .eq("id", row.id);

    if (updateError) {
      failedCount += 1;
      resultRows.push({
        action: "db_update_failed",
        assetId: row.id,
        cloudinaryPublicId: renameResult.payload.public_id,
        error: updateError.message,
        from: currentPublicId,
        to: targetPublicId,
      });
      continue;
    }

    movedCount += 1;
    resultRows.push({
      action: "moved",
      assetId: row.id,
      from: currentPublicId,
      secureUrl,
      to: renameResult.payload.public_id,
    });
  }

  const report = {
    apply: options.apply,
    folder,
    generatedAt: new Date().toISOString(),
    summary: {
      alreadyInFolderCount,
      failedCount,
      movedCount,
      totalAssets: rows.length,
    },
    rows: resultRows,
  };

  const reportPath = resolveReportPath(
    "rehearsal",
    "cloudinary-relocation-report",
    options.report
  );
  writeJsonReport(reportPath, report);

  if (options.apply) {
    await admin.from("operator_reports").insert({
      report,
      report_type: "content_inventory",
      status: failedCount === 0 ? "completed" : "warning",
      summary: `Cloudinary relocation moved ${movedCount} assets to ${folder}.`,
      title: "Cloudinary relocation run",
    });
  }

  console.log(
    JSON.stringify(
      {
        apply: options.apply,
        reportPath,
        summary: report.summary,
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
          error instanceof Error
            ? error.message
            : "Unknown cloudinary relocation error",
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});

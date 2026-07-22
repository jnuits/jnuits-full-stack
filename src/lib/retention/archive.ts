import "server-only";

import { createHmac } from "node:crypto";
import {
  formSubmissionsToExportTable,
  type FormSubmissionExportRow,
} from "@/lib/exports/form-submissions";
import { createCsv, sha256 } from "@/lib/exports/tabular";
import { createXlsxWorkbook } from "@/lib/exports/xlsx";

export type RetentionArchiveScope = "event" | "form";

export type RetentionArchiveAssetReference = {
  assetId: string;
  bytes: number;
  contentType: string;
  folder: string;
  publicId: string;
  sha256: string;
  version: string;
};

export type RetentionArchiveDriveFile = {
  bytes: number;
  id: string;
  name: string;
  sha256: string;
};

export type RetentionArchiveSubmissionRow = FormSubmissionExportRow & {
  assets: Array<
    FormSubmissionExportRow["assets"][number] & {
      bytes: number;
      content_type: string;
      sha256: string;
    }
  >;
};

export type SignedRetentionArchiveManifest = {
  algorithm: "HMAC-SHA256";
  manifest: {
    archivedAt: string;
    assetReferences: RetentionArchiveAssetReference[];
    files: RetentionArchiveDriveFile[];
    resourceId: string;
    rowCount: number;
    schemaVersion: 1;
    scope: RetentionArchiveScope;
  };
  signature: string;
};

function manifestSecret() {
  return process.env.RETENTION_MANIFEST_SIGNING_SECRET?.trim() || "";
}

function asAssetReferences(
  rows: readonly RetentionArchiveSubmissionRow[]
): RetentionArchiveAssetReference[] {
  const references = new Map<string, RetentionArchiveAssetReference>();

  for (const row of rows) {
    for (const asset of row.assets) {
      const value: RetentionArchiveAssetReference = {
        assetId: asset.cloudinary_asset_id,
        bytes: asset.bytes,
        contentType: asset.content_type,
        folder: asset.cloudinary_folder,
        publicId: asset.cloudinary_public_id,
        sha256: asset.sha256,
        version: asset.cloudinary_version,
      };
      references.set(`${value.assetId}:${value.version}`, value);
    }
  }

  return [...references.values()].sort((left, right) =>
    left.assetId.localeCompare(right.assetId)
  );
}

export function createFormArchiveMaterials(
  formDefinitionId: string,
  rows: readonly RetentionArchiveSubmissionRow[]
) {
  const table = formSubmissionsToExportTable(rows);
  const csv = Buffer.from(createCsv(table), "utf8");
  const xlsx = createXlsxWorkbook(table, "Form submissions");
  const assetReferences = asAssetReferences(rows);
  const json = Buffer.from(
    JSON.stringify(
      {
        assetReferences,
        exportedAt: new Date().toISOString(),
        formDefinitionId,
        schemaVersion: 1,
        submissions: table.rows,
      },
      null,
      2
    ),
    "utf8"
  );

  return { assetReferences, csv, json, rowCount: rows.length, xlsx };
}

export function archiveRetentionDriveFile(
  name: string,
  id: string,
  data: Buffer
): RetentionArchiveDriveFile {
  return { bytes: data.length, id, name, sha256: sha256(data) };
}

export function signRetentionArchiveManifest({
  archivedAt,
  assetReferences,
  files,
  resourceId,
  rowCount,
  scope,
}: {
  archivedAt: string;
  assetReferences: RetentionArchiveAssetReference[];
  files: RetentionArchiveDriveFile[];
  resourceId: string;
  rowCount: number;
  scope: RetentionArchiveScope;
}): SignedRetentionArchiveManifest {
  const secret = manifestSecret();

  if (!secret) {
    throw new Error("Retention manifest signing is not configured.");
  }

  const manifest = {
    archivedAt,
    assetReferences,
    files,
    resourceId,
    rowCount,
    schemaVersion: 1 as const,
    scope,
  };

  return {
    algorithm: "HMAC-SHA256",
    manifest,
    signature: createHmac("sha256", secret)
      .update(JSON.stringify(manifest))
      .digest("hex"),
  };
}

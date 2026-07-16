import "server-only";

import { createHmac } from "node:crypto";
import {
  eventRegistrationsToExportTable,
  type EventRegistrationExportRow,
} from "./event-registrations";
import { createCsv, sha256 } from "./tabular";
import { createXlsxWorkbook } from "./xlsx";

export type EventArchiveDriveFile = {
  bytes: number;
  id: string;
  name: string;
  sha256: string;
};

export type SignedEventArchiveManifest = {
  algorithm: "HMAC-SHA256";
  manifest: {
    archivedAt: string;
    assetReferences: [];
    eventId: string;
    files: EventArchiveDriveFile[];
    rowCount: number;
    schemaVersion: 1;
  };
  signature: string;
};

function manifestSecret() {
  return process.env.RETENTION_MANIFEST_SIGNING_SECRET?.trim() || "";
}

export function createEventArchiveMaterials(
  eventId: string,
  rows: readonly EventRegistrationExportRow[]
) {
  const table = eventRegistrationsToExportTable(rows);
  const csv = Buffer.from(createCsv(table), "utf8");
  const xlsx = createXlsxWorkbook(table, "Event registrations");
  const json = Buffer.from(
    JSON.stringify(
      {
        eventId,
        exportedAt: new Date().toISOString(),
        registrations: table.rows,
        schemaVersion: 1,
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    csv,
    json,
    rowCount: rows.length,
    xlsx,
  };
}

export function signEventArchiveManifest({
  archivedAt,
  eventId,
  files,
  rowCount,
}: {
  archivedAt: string;
  eventId: string;
  files: EventArchiveDriveFile[];
  rowCount: number;
}): SignedEventArchiveManifest {
  const secret = manifestSecret();

  if (!secret) {
    throw new Error("Retention manifest signing is not configured.");
  }

  const manifest = {
    archivedAt,
    assetReferences: [] as [],
    eventId,
    files,
    rowCount,
    schemaVersion: 1 as const,
  };
  const signature = createHmac("sha256", secret)
    .update(JSON.stringify(manifest))
    .digest("hex");

  return {
    algorithm: "HMAC-SHA256",
    manifest,
    signature,
  };
}

export function archiveDriveFile(
  name: string,
  id: string,
  data: Buffer
): EventArchiveDriveFile {
  return {
    bytes: data.length,
    id,
    name,
    sha256: sha256(data),
  };
}


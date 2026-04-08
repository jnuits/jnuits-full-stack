import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

const REPORT_ROOT = path.join(process.cwd(), "artifacts", "reports");
const DEFAULT_LEGACY_STRAPI_ROOT = "M:/jnuits/admin.jnuits.org.bd";
const DEFAULT_LEGACY_FRONTEND_ROOT = "M:/jnuits/jnuits.org.bd";

export function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
  return targetPath;
}

export function toStamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function resolveReportPath(section, name, explicitPath = "") {
  const reportRoot = ensureDirectory(path.join(REPORT_ROOT, section));
  return explicitPath
    ? path.resolve(process.cwd(), explicitPath)
    : path.join(reportRoot, `${name}-${toStamp()}.json`);
}

export function writeJsonReport(filePath, report) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 120);
}

export function extractPlainText(value) {
  return String(value || "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/[`*_>#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function deriveSummary(value, maxLength = 220) {
  const text = extractPlainText(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trim()}…`;
}

export function deriveReadTime(value) {
  const words = extractPlainText(value)
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

export function buildSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required."
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getLegacyRoots() {
  const legacyStrapiRoot = process.env.LEGACY_STRAPI_ROOT || DEFAULT_LEGACY_STRAPI_ROOT;
  const legacyFrontendRoot =
    process.env.LEGACY_FRONTEND_ROOT || DEFAULT_LEGACY_FRONTEND_ROOT;
  const legacyEnvPath =
    process.env.LEGACY_STRAPI_ENV_PATH || path.join(legacyStrapiRoot, ".env");

  return {
    legacyEnvPath,
    legacyFrontendRoot,
    legacyStrapiRoot,
  };
}

export function loadLegacyEnv() {
  const { legacyEnvPath } = getLegacyRoots();

  if (!fs.existsSync(legacyEnvPath)) {
    throw new Error(`Legacy Strapi env file not found: ${legacyEnvPath}`);
  }

  return dotenv.parse(fs.readFileSync(legacyEnvPath, "utf8"));
}

export async function buildLegacyMysqlConnection() {
  const legacyEnv = loadLegacyEnv();

  return mysql.createConnection({
    database: legacyEnv.DATABASE_NAME,
    host: legacyEnv.DATABASE_HOST,
    password: legacyEnv.DATABASE_PASSWORD,
    port: Number(legacyEnv.DATABASE_PORT),
    ssl: {
      rejectUnauthorized: false,
    },
    user: legacyEnv.DATABASE_USERNAME,
  });
}

export function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not fully configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
  }

  return { apiKey, apiSecret, cloudName };
}

export function normalizeCloudinaryPublicId(value) {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[^a-zA-Z0-9/_-]+/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .slice(0, 180);
}

export function createCloudinarySignature(params, apiSecret) {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");

  return crypto.createHash("sha1").update(`${serialized}${apiSecret}`).digest("hex");
}

function resolveNextStaticAssetPath(candidatePath) {
  const { legacyFrontendRoot } = getLegacyRoots();
  const filename = path.basename(candidatePath);
  const parts = filename.split(".");

  if (parts.length < 3) {
    return null;
  }

  const originalName = `${parts.slice(0, -2).join(".")}.${parts.at(-1)}`;
  const resolved = path.join(legacyFrontendRoot, "public", "images", originalName);
  return fs.existsSync(resolved) ? resolved : null;
}

export function resolveLegacyAssetSource(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return null;
  }

  const { legacyFrontendRoot, legacyStrapiRoot } = getLegacyRoots();

  if (path.isAbsolute(trimmed) && fs.existsSync(trimmed)) {
    return { kind: "local", value: trimmed };
  }

  if (trimmed.startsWith("/images/")) {
    const resolved = path.join(legacyFrontendRoot, "public", trimmed.replace(/^\//, ""));
    return fs.existsSync(resolved) ? { kind: "local", value: resolved } : null;
  }

  if (trimmed.startsWith("/uploads/")) {
    const resolved = path.join(legacyStrapiRoot, "public", trimmed.replace(/^\//, ""));
    return fs.existsSync(resolved) ? { kind: "local", value: resolved } : null;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.pathname.startsWith("/images/")) {
      const resolved = path.join(
        legacyFrontendRoot,
        "public",
        parsed.pathname.replace(/^\//, "")
      );
      if (fs.existsSync(resolved)) {
        return { kind: "local", value: resolved };
      }
    }

    if (parsed.pathname.startsWith("/uploads/")) {
      const resolved = path.join(
        legacyStrapiRoot,
        "public",
        parsed.pathname.replace(/^\//, "")
      );
      if (fs.existsSync(resolved)) {
        return { kind: "local", value: resolved };
      }
    }

    if (parsed.pathname.includes("/_next/static/media/")) {
      const resolved = resolveNextStaticAssetPath(parsed.pathname);
      if (resolved) {
        return { kind: "local", value: resolved };
      }
    }

    return { kind: "remote", value: trimmed };
  } catch {
    return null;
  }
}

export async function ensureCloudinaryImageAsset({
  altText,
  metadata,
  publicId,
  source,
  supabase,
  title,
}) {
  const normalizedPublicId = normalizeCloudinaryPublicId(publicId);

  if (!normalizedPublicId) {
    throw new Error("Cloudinary public ID is required.");
  }

  const { data: existingAsset } = await supabase
    .from("media_assets")
    .select("id, secure_url, thumbnail_url, public_id")
    .eq("public_id", normalizedPublicId)
    .maybeSingle();

  if (existingAsset) {
    return existingAsset;
  }

  const cloudinary = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const uploadParams = {
    overwrite: "true",
    public_id: normalizedPublicId,
    timestamp,
  };
  const signature = createCloudinarySignature(uploadParams, cloudinary.apiSecret);
  const formData = new FormData();

  formData.append("api_key", cloudinary.apiKey);
  formData.append("overwrite", "true");
  formData.append("public_id", normalizedPublicId);
  formData.append("signature", signature);
  formData.append("timestamp", String(timestamp));

  if (source.kind === "remote") {
    formData.append("file", source.value);
  } else {
    const fileBuffer = fs.readFileSync(source.value);
    const fileName = path.basename(source.value);
    const blob = new Blob([fileBuffer]);
    formData.append("file", blob, fileName);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/upload`,
    {
      body: formData,
      method: "POST",
    }
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.secure_url || !payload?.public_id) {
    throw new Error(
      `Cloudinary upload failed for ${normalizedPublicId}: ${
        payload?.error?.message || response.statusText
      }`
    );
  }

  const assetPayload = {
    alt_text: altText || null,
    bytes:
      typeof payload.bytes === "number" && Number.isFinite(payload.bytes)
        ? payload.bytes
        : null,
    format: payload.format || null,
    height:
      typeof payload.height === "number" && Number.isFinite(payload.height)
        ? payload.height
        : null,
    is_public: true,
    media_kind: "image",
    metadata: metadata || {},
    provider: "cloudinary",
    public_id: payload.public_id,
    resource_type: payload.resource_type || "image",
    secure_url: payload.secure_url,
    thumbnail_url:
      payload.secure_url && payload.format
        ? payload.secure_url
        : null,
    title: title || null,
    width:
      typeof payload.width === "number" && Number.isFinite(payload.width)
        ? payload.width
        : null,
  };

  const { data: savedAsset, error } = await supabase
    .from("media_assets")
    .upsert(assetPayload, { onConflict: "public_id" })
    .select("id, secure_url, thumbnail_url, public_id")
    .single();

  if (error || !savedAsset) {
    throw new Error(error?.message || "Unable to register Cloudinary asset.");
  }

  return savedAsset;
}

export function ensureLegacyDownloadCopy(sourceRelativePath, targetRelativePath) {
  const { legacyStrapiRoot } = getLegacyRoots();
  const sourcePath = path.join(
    legacyStrapiRoot,
    "public",
    sourceRelativePath.replace(/^\//, "")
  );
  const targetPath = path.join(process.cwd(), "public", targetRelativePath.replace(/^\//, ""));

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Legacy file not found: ${sourcePath}`);
  }

  ensureDirectory(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
  return targetPath;
}

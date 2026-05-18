import "server-only";

import { createCloudinarySignature, getCloudinaryConfig } from "@/lib/cloudinary/config";
import { CLOUDINARY_NOTICE_FOLDER } from "@/lib/branding";

export type NoticeAttachmentUploadResult = {
  publicId: string;
  url: string;
};

const NOTICE_ATTACHMENT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const NOTICE_ATTACHMENT_ALLOWED_TYPES = new Set(["application/pdf"]);
const NOTICE_ATTACHMENT_ALLOWED_EXTENSION = /\.pdf$/i;

function sanitizePublicId(value: string) {
  return value
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function validateNoticeAttachmentFile(file: File) {
  if (file.size <= 0) {
    throw new Error("Choose a non-empty PDF notice attachment.");
  }

  if (file.size > NOTICE_ATTACHMENT_MAX_UPLOAD_BYTES) {
    throw new Error("Notice PDF attachments must be 20 MB or smaller.");
  }

  const hasAllowedType = NOTICE_ATTACHMENT_ALLOWED_TYPES.has(file.type);
  const hasAllowedExtension = NOTICE_ATTACHMENT_ALLOWED_EXTENSION.test(file.name);

  if (!hasAllowedType && !hasAllowedExtension) {
    throw new Error("Notice attachments must be PDF files.");
  }
}

export async function uploadNoticeAttachmentToCloudinary(
  file: File,
  fallbackName = "notice-attachment"
): Promise<NoticeAttachmentUploadResult> {
  validateNoticeAttachmentFile(file);

  const config = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicIdBase =
    sanitizePublicId(file.name) || sanitizePublicId(fallbackName) || "notice-attachment";
  const publicId = `${publicIdBase}-${timestamp}.pdf`;
  const params = {
    folder: CLOUDINARY_NOTICE_FOLDER,
    overwrite: false,
    public_id: publicId,
    timestamp,
  };
  const signature = createCloudinarySignature(params, config.apiSecret);
  const body = new FormData();

  body.append("api_key", config.apiKey);
  body.append("file", file);
  body.append("folder", CLOUDINARY_NOTICE_FOLDER);
  body.append("overwrite", "false");
  body.append("public_id", publicId);
  body.append("signature", signature);
  body.append("timestamp", String(timestamp));

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/raw/upload`,
    {
      body,
      method: "POST",
    }
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        error?: { message?: string };
        public_id?: string;
        secure_url?: string;
      }
    | null;

  if (!response.ok || !payload?.secure_url || !payload.public_id) {
    throw new Error(
      payload?.error?.message || "Cloudinary upload failed for the notice PDF."
    );
  }

  return {
    publicId: payload.public_id,
    url: payload.secure_url,
  };
}

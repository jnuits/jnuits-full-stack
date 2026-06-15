import { CLOUDINARY_PROJECT_ROOT_FOLDER } from "@/lib/branding";

export const BLOG_COVER_UPLOAD_FOLDER = `${CLOUDINARY_PROJECT_ROOT_FOLDER}/blogs`;

export type BlogMediaOption = {
  alt_text?: null | string;
  id: string;
  media_kind: string;
  public_id: string;
  secure_url?: null | string;
  thumbnail_url?: null | string;
  title: null | string;
};

export type RegisteredBlogMediaAsset = {
  altText?: null | string;
  id: string;
  mediaKind?: null | string;
  publicId?: null | string;
  secureUrl?: null | string;
  thumbnailUrl?: null | string;
  title?: null | string;
};

type BlogCoverUploadFile = {
  size: number;
  type: string;
};

export function isValidBlogCoverUploadFile(
  file: BlogCoverUploadFile | null | undefined
) {
  return Boolean(file && file.size > 0 && file.type.startsWith("image/"));
}

export function mapRegisteredBlogMediaOption(options: {
  altText?: null | string;
  fallbackTitle?: null | string;
  publicId: string;
  registered?: null | RegisteredBlogMediaAsset;
  secureUrl: string;
}): BlogMediaOption {
  const title = options.registered?.title || options.fallbackTitle || null;
  const altText = options.registered?.altText || options.altText || title;
  const secureUrl = options.registered?.secureUrl || options.secureUrl;

  return {
    alt_text: altText || null,
    id: options.registered?.id || options.publicId,
    media_kind: options.registered?.mediaKind || "image",
    public_id: options.registered?.publicId || options.publicId,
    secure_url: secureUrl,
    thumbnail_url: options.registered?.thumbnailUrl || secureUrl,
    title,
  };
}

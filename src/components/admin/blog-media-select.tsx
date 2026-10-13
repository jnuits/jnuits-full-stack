"use client";

import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { CLOUDINARY_PROJECT_ROOT_FOLDER } from "@/lib/branding";
import {
  BLOG_COVER_UPLOAD_FOLDER,
  isValidBlogCoverUploadFile,
  mapRegisteredBlogMediaOption,
  type BlogMediaOption,
  type RegisteredBlogMediaAsset,
} from "@/lib/content/blog-media";

export type { BlogMediaOption } from "@/lib/content/blog-media";

type BlogMediaSelectProps = {
  assets: BlogMediaOption[];
  defaultValue?: null | string;
  fallbackSecureUrl?: null | string;
  secureUrlFieldName?: string;
  uploadEnabled?: boolean;
  context?: "blog" | "project";
};

type BlogCoverUploadState = {
  error: null | string;
  message: null | string;
  pending: boolean;
};

type CloudinarySignResponse = {
  apiKey?: string;
  folder?: string;
  signature?: string;
  timestamp?: number;
  uploadPreset?: null | string;
  uploadUrl?: string;
  message?: string;
};

type CloudinaryUploadResponse = {
  bytes?: number;
  format?: string;
  height?: number;
  public_id?: string;
  resource_type?: string;
  secure_url?: string;
  width?: number;
  message?: string;
};

type MediaRegisterResponse = {
  data?: RegisteredBlogMediaAsset;
  message?: string;
};

function preventCoverUploadEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") {
    event.preventDefault();
  }
}

export function BlogMediaSelect({
  assets,
  defaultValue = "",
  fallbackSecureUrl = "",
  secureUrlFieldName = "selectedMediaSecureUrl",
  uploadEnabled = true,
  context = "blog",
}: BlogMediaSelectProps) {
  const [options, setOptions] = useState(assets);
  const retainedCoverValue = "__current_cover__";
  const [value, setValue] = useState(defaultValue || (fallbackSecureUrl ? retainedCoverValue : ""));
  const uploadFolder = context === "project" ? `${CLOUDINARY_PROJECT_ROOT_FOLDER}/projects` : BLOG_COVER_UPLOAD_FOLDER;
  const selectedUrlFallback = value === retainedCoverValue ? fallbackSecureUrl || "" : "";
  const [query, setQuery] = useState("");
  const [upload, setUpload] = useState<BlogCoverUploadState>({
    error: null,
    message: null,
    pending: false,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const altTextInputRef = useRef<HTMLInputElement | null>(null);
  const selected = useMemo(
    () => options.find((asset) => asset.id === value) || null,
    [options, value]
  );
  const visibleAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((asset) =>
      [asset.title, asset.public_id, asset.alt_text]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(normalizedQuery))
    );
  }, [options, query]);
  const selectAssets =
    selected && !visibleAssets.some((asset) => asset.id === selected.id)
      ? [selected, ...visibleAssets]
      : visibleAssets;
  const previewSrc = selected?.thumbnail_url || selected?.secure_url || selectedUrlFallback;
  const selectedAltText =
    selected?.alt_text || selected?.title || selected?.public_id || "";

  async function uploadCoverImage() {
    const file = fileInputRef.current?.files?.[0] || null;
    const title = titleInputRef.current?.value.trim() || "";
    const altText = altTextInputRef.current?.value.trim() || title;

    if (!file || !isValidBlogCoverUploadFile(file)) {
      setUpload({
        error: `Choose an image file before uploading a ${context} cover.`,
        message: null,
        pending: false,
      });
      return;
    }

    setUpload({
      error: null,
      message: null,
      pending: true,
    });

    try {
      const signResponse = await fetch("/api/admin/cloudinary/sign", {
        body: JSON.stringify({
          folder: uploadFolder,
          resourceType: "image",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const signBody = (await signResponse.json().catch(() => null)) as
        | CloudinarySignResponse
        | null;

      if (
        !signResponse.ok ||
        !signBody?.apiKey ||
        !signBody.signature ||
        !signBody.timestamp ||
        !signBody.uploadUrl
      ) {
        throw new Error(signBody?.message || "Unable to sign the cover upload.");
      }

      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("api_key", signBody.apiKey);
      uploadData.append("timestamp", String(signBody.timestamp));
      uploadData.append("signature", signBody.signature);
      uploadData.append("folder", signBody.folder || BLOG_COVER_UPLOAD_FOLDER);
      uploadData.append("use_filename", "true");
      uploadData.append("unique_filename", "true");

      if (signBody.uploadPreset) {
        uploadData.append("upload_preset", signBody.uploadPreset);
      }

      const cloudinaryResponse = await fetch(signBody.uploadUrl, {
        body: uploadData,
        method: "POST",
      });
      const cloudinaryBody = (await cloudinaryResponse.json().catch(() => null)) as
        | CloudinaryUploadResponse
        | null;

      if (
        !cloudinaryResponse.ok ||
        !cloudinaryBody?.public_id ||
        !cloudinaryBody.secure_url
      ) {
        throw new Error(cloudinaryBody?.message || "Cloudinary upload failed.");
      }

      const registerResponse = await fetch("/api/admin/media-assets/register", {
        body: JSON.stringify({
          altText: altText || undefined,
          bytes: typeof cloudinaryBody.bytes === "number" ? cloudinaryBody.bytes : null,
          format: cloudinaryBody.format || null,
          height:
            typeof cloudinaryBody.height === "number" ? cloudinaryBody.height : null,
          isPublic: true,
          mediaKind: "image",
          metadata: {
            folder: signBody.folder || BLOG_COVER_UPLOAD_FOLDER,
            source: `${context}-cover-upload`,
          },
          publicId: cloudinaryBody.public_id,
          resourceType: cloudinaryBody.resource_type || "image",
          secureUrl: cloudinaryBody.secure_url,
          thumbnailUrl: cloudinaryBody.secure_url,
          title: title || undefined,
          width: typeof cloudinaryBody.width === "number" ? cloudinaryBody.width : null,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const registerBody = (await registerResponse.json().catch(() => null)) as
        | MediaRegisterResponse
        | null;

      if (!registerResponse.ok || !registerBody?.data?.id) {
        throw new Error(
          registerBody?.message || "The uploaded cover could not be registered."
        );
      }

      const option = mapRegisteredBlogMediaOption({
        altText,
        fallbackTitle: title,
        publicId: cloudinaryBody.public_id,
        registered: registerBody.data,
        secureUrl: cloudinaryBody.secure_url,
      });

      setOptions((current) => [
        option,
        ...current.filter((asset) => asset.id !== option.id),
      ]);
      setValue(option.id);
      setQuery("");
      setUpload({
        error: null,
        message: "Cover image uploaded and selected.",
        pending: false,
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setUpload({
        error:
          error instanceof Error
            ? error.message
            : "The cover image could not be uploaded.",
        message: null,
        pending: false,
      });
    }
  }

  return (
    <div className="blog-media-select">
      <input
        name={secureUrlFieldName}
        type="hidden"
        value={selected?.secure_url || selectedUrlFallback}
      />
      <input name="selectedMediaAltText" type="hidden" value={selectedAltText} />
      <label className="input-label">
        Search media
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title or Cloudinary public ID"
          type="search"
          value={query}
        />
      </label>
      <label className="input-label">
        Cover image
        <select
          name="mediaAssetId"
          onChange={(event) => setValue(event.target.value)}
          value={value}
        >
          <option value="">No cover image</option>
          {fallbackSecureUrl && !selected ? <option value={retainedCoverValue}>Keep current cover</option> : null}
          {selectAssets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.title || asset.public_id} ({asset.media_kind})
            </option>
          ))}
        </select>
      </label>
      <p className="blog-media-select__hint">
        Recommended: add a 16:9 Cloudinary cover image before publishing.
      </p>
      {uploadEnabled ? <div className="blog-cover-upload">
        <p className="admin-section-label">Upload/select cover</p>
        <label className="input-label">
          Image file
          <input accept="image/*" ref={fileInputRef} type="file" />
        </label>
        <label className="input-label">
          Title
          <input
            onKeyDown={preventCoverUploadEnter}
            placeholder={context === "project" ? "Project cover title" : "Blog cover title"}
            ref={titleInputRef}
            type="text"
          />
        </label>
        <label className="input-label">
          Alt text
          <input
            onKeyDown={preventCoverUploadEnter}
            placeholder="Describe the cover image"
            ref={altTextInputRef}
            type="text"
          />
        </label>
        <button
          className="admin-btn admin-btn--ghost"
          disabled={upload.pending}
          onClick={uploadCoverImage}
          type="button"
        >
          {upload.pending ? "Uploading..." : "Upload cover"}
        </button>
        {upload.message ? (
          <p className="portal-message portal-message--success">{upload.message}</p>
        ) : null}
        {upload.error ? (
          <p className="portal-message portal-message--error">{upload.error}</p>
        ) : null}
      </div> : null}
      <div className="blog-media-select__preview">
        {previewSrc ? (
          <Image
            alt={selectedAltText || "Selected blog cover"}
            className="object-cover"
            fill
            sizes="(min-width: 1024px) 18rem, 100vw"
            src={previewSrc}
            unoptimized={Boolean(selectedUrlFallback)}
          />
        ) : (
          <div className="blog-media-select__placeholder">
            <span>Cover image optional</span>
            <strong>Cloudinary media registry</strong>
          </div>
        )}
      </div>
    </div>
  );
}

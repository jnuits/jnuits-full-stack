"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

export type BlogMediaOption = {
  alt_text?: null | string;
  id: string;
  media_kind: string;
  public_id: string;
  secure_url?: null | string;
  thumbnail_url?: null | string;
  title: null | string;
};

type BlogMediaSelectProps = {
  assets: BlogMediaOption[];
  defaultValue?: null | string;
};

export function BlogMediaSelect({
  assets,
  defaultValue = "",
}: BlogMediaSelectProps) {
  const [value, setValue] = useState(defaultValue || "");
  const selected = useMemo(
    () => assets.find((asset) => asset.id === value) || null,
    [assets, value]
  );
  const previewSrc = selected?.thumbnail_url || selected?.secure_url || "";

  return (
    <div className="blog-media-select">
      <label className="input-label">
        Cover image
        <select
          name="mediaAssetId"
          onChange={(event) => setValue(event.target.value)}
          value={value}
        >
          <option value="">No cover image</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.title || asset.public_id} ({asset.media_kind})
            </option>
          ))}
        </select>
      </label>
      <div className="blog-media-select__preview">
        {previewSrc ? (
          <Image
            alt={selected?.alt_text || selected?.title || "Selected blog cover"}
            className="object-cover"
            fill
            sizes="(min-width: 1024px) 18rem, 100vw"
            src={previewSrc}
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

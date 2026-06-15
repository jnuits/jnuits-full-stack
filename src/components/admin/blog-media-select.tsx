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
  const [query, setQuery] = useState("");
  const selected = useMemo(
    () => assets.find((asset) => asset.id === value) || null,
    [assets, value]
  );
  const visibleAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return assets;
    }

    return assets.filter((asset) =>
      [asset.title, asset.public_id, asset.alt_text]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(normalizedQuery))
    );
  }, [assets, query]);
  const selectAssets =
    selected && !visibleAssets.some((asset) => asset.id === selected.id)
      ? [selected, ...visibleAssets]
      : visibleAssets;
  const previewSrc = selected?.thumbnail_url || selected?.secure_url || "";
  const selectedAltText =
    selected?.alt_text || selected?.title || selected?.public_id || "";

  return (
    <div className="blog-media-select">
      <input
        name="selectedMediaSecureUrl"
        type="hidden"
        value={selected?.secure_url || ""}
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
          {selectAssets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.title || asset.public_id} ({asset.media_kind})
            </option>
          ))}
        </select>
      </label>
      <p className="blog-media-select__hint">
        Recommended: add a 16:9 cover image for listing and sharing.
      </p>
      <div className="blog-media-select__preview">
        {previewSrc ? (
          <Image
            alt={selectedAltText || "Selected blog cover"}
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

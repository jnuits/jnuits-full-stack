"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CLOUDINARY_PROJECT_ROOT_FOLDER,
  CLOUDINARY_SLIDER_FOLDER,
} from "@/lib/branding";

type CloudinaryResult = {
  filename: string;
  publicId: string;
  url: string;
};

type CloudinaryPickerProps = {
  disabled?: boolean;
  onSelect?: (url: string) => void;
  onUrlBlur?: (url: string) => void;
  onValueChange?: (url: string) => void;
  value?: string;
};

export function CloudinaryPicker({
  disabled = false,
  onSelect,
  onUrlBlur,
  onValueChange,
  value,
}: CloudinaryPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CloudinaryResult[]>([]);
  const [initialResults, setInitialResults] = useState<CloudinaryResult[]>([]);
  const [internalSelectedUrl, setInternalSelectedUrl] = useState("");
  const [loading, setLoading] = useState(!disabled);
  const [error, setError] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const selectedUrl = value ?? internalSelectedUrl;

  function updateSelectedUrl(nextUrl: string) {
    if (value === undefined) {
      setInternalSelectedUrl(nextUrl);
    }

    onValueChange?.(nextUrl);
  }

  useEffect(() => {
    if (disabled) {
      return;
    }

    const controller = new AbortController();

    fetchCloudinaryImages("", controller.signal)
      .then((items) => {
        setInitialResults(items);
        setResults(items);
        setError("");
      })
      .catch((fetchError) => {
        if (isAbortError(fetchError)) {
          return;
        }

        setInitialResults([]);
        setResults([]);
        setError("Could not load Cloudinary library. Check credentials.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [disabled]);

  useEffect(() => {
    const searchQuery = debouncedQuery.trim();

    if (disabled || !searchQuery) {
      return;
    }

    const controller = new AbortController();

    fetchCloudinaryImages(searchQuery, controller.signal)
      .then((items) => {
        setResults(items);
        setError("");
      })
      .catch((fetchError) => {
        if (isAbortError(fetchError)) {
          return;
        }

        setResults([]);
        setError("Could not load Cloudinary library. Check credentials.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [debouncedQuery, disabled]);

  const skeletons = useMemo(() => Array.from({ length: 8 }, (_, index) => index), []);

  return (
    <div className="grid gap-4">
      <label className="input-label">
        Existing image URL
        <input
          disabled={disabled}
          name="existingImageUrl"
          onBlur={(event) => onUrlBlur?.(event.target.value)}
          onChange={(event) => updateSelectedUrl(event.target.value)}
          placeholder="https://res.cloudinary.com/..."
          type="url"
          value={selectedUrl}
        />
      </label>

      <div className="grid gap-3 rounded-xl border border-[var(--color-border-secondary)] p-4">
        <div className="grid gap-1">
          <label className="input-label w-full max-w-sm">
            Pick from Cloudinary
            <input
              disabled={disabled}
              onChange={(event) => {
                const nextQuery = event.target.value;

                setError("");
                setQuery(nextQuery);

                if (nextQuery.trim()) {
                  setLoading(true);
                  return;
                }

                setResults(initialResults);
                setLoading(false);
              }}
              placeholder="Search Cloudinary library..."
              value={query}
            />
          </label>
          <p className="admin-slider-cloudinary-scope">
            Searching in: {CLOUDINARY_PROJECT_ROOT_FOLDER} and subfolders
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-[var(--brand-rust)] p-4">
            <p className="text-sm text-[var(--brand-rust)]">{error}</p>
            <button
              className="admin-btn admin-btn--ghost mt-3"
              disabled={disabled}
              onClick={() => {
                setError("");
                setLoading(true);
                fetchCloudinaryImages(query.trim())
                  .then((items) => {
                    if (!query.trim()) {
                      setInitialResults(items);
                    }
                    setResults(items);
                  })
                  .catch(() => {
                    setResults([]);
                    setError(
                      "Could not load Cloudinary library. Check credentials."
                    );
                  })
                  .finally(() => setLoading(false));
              }}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {skeletons.map((item) => (
              <div
                aria-hidden="true"
                className="h-[60px] w-full animate-pulse rounded-lg bg-[var(--color-border-tertiary)]"
                key={item}
              />
            ))}
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {results.map((asset) => (
              <button
                aria-label={`Use ${asset.filename}`}
                className="group grid min-h-20 gap-2 rounded-lg border border-[var(--color-border-secondary)] p-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                data-selected={selectedUrl === asset.url ? "true" : "false"}
                key={asset.publicId}
                onClick={() => {
                  updateSelectedUrl(asset.url);
                  onSelect?.(asset.url);
                }}
                type="button"
              >
                <span className="relative block h-[60px] w-full overflow-hidden rounded-md bg-[var(--color-background-secondary)] ring-0 group-data-[selected=true]:ring-2 group-data-[selected=true]:ring-[var(--color-primary)]">
                  <Image
                    alt={asset.filename}
                    className="object-cover"
                    fill
                    sizes="80px"
                    src={asset.url}
                    unoptimized
                  />
                </span>
                <span className="truncate text-xs text-[var(--color-text-secondary)]">
                  {asset.filename}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="admin-slider-cloudinary-empty">
            <span className="admin-slider-cloudinary-empty__icon" aria-hidden="true">
              <ImageIcon size={22} />
            </span>
            <h3>Cloudinary library is empty</h3>
            <p>Upload an image using the file input above.</p>
            <p>It will be copied to {CLOUDINARY_SLIDER_FOLDER} and appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

async function fetchCloudinaryImages(query: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/admin/cloudinary-search?q=${encodeURIComponent(query)}`,
    { signal }
  );
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.message || "Cloudinary search failed.");
  }

  return payload as CloudinaryResult[];
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebounced(value), delay);

    return () => window.clearTimeout(timeoutId);
  }, [delay, value]);

  return debounced;
}


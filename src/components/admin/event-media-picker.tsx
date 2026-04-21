"use client";

import Image from "next/image";
import {
  ExternalLink,
  Image as ImageIcon,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

type MediaPickerAsset = {
  altText: string | null;
  id: string;
  publicId: string;
  secureUrl: string;
  thumbnailUrl: string;
  title: string | null;
};

type MediaPickerResponse = {
  items: MediaPickerAsset[];
  page: number;
  totalItems: number;
  totalPages: number;
};

type EventMediaPickerProps = {
  initialSelectedAsset: MediaPickerAsset | null;
};

export function EventMediaPicker({
  initialSelectedAsset,
}: EventMediaPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pending, startTransition] = useTransition();
  const [selectedAsset, setSelectedAsset] = useState<MediaPickerAsset | null>(
    initialSelectedAsset
  );
  const [pickerData, setPickerData] = useState<MediaPickerResponse>({
    items: [],
    page: 1,
    totalItems: 0,
    totalPages: 1,
  });
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 240);

    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const params = new URLSearchParams();

    if (debouncedQuery) {
      params.set("q", debouncedQuery);
    }

    params.set("page", String(page));

    startTransition(() => {
      fetch(`/api/admin/events/media-assets?${params.toString()}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as
            | MediaPickerResponse
            | { message?: string }
            | null;

          if (!response.ok || !payload || !("items" in payload)) {
            throw new Error(
              payload && "message" in payload && payload.message
                ? payload.message
                : "Unable to load media assets."
            );
          }

          setPickerData(payload);
          setError(null);
        })
        .catch((fetchError) => {
          if (controller.signal.aborted) {
            return;
          }

          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Unable to load media assets."
          );
        });
    });

    return () => controller.abort();
  }, [debouncedQuery, isOpen, page]);

  const selectionLabel = useMemo(() => {
    if (!selectedAsset) {
      return "No cover selected";
    }

    return selectedAsset.title || selectedAsset.publicId;
  }, [selectedAsset]);

  return (
    <div className="grid gap-4">
      <input
        name="coverMediaAssetId"
        type="hidden"
        value={selectedAsset?.id || ""}
      />

      <div className="admin-review-card grid gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="admin-section-label">Cover image</p>
            <h2 className="admin-card-row__title">Media library picker</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
              Reuse an existing Cloudinary image from the shared media registry.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="admin-btn admin-btn--ghost"
              onClick={() => setIsOpen(true)}
              type="button"
            >
              Browse library
            </button>
            {selectedAsset ? (
              <button
                className="admin-btn admin-btn--ghost"
                onClick={() => setSelectedAsset(null)}
                type="button"
              >
                Clear cover
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="relative min-h-[180px] overflow-hidden rounded-[1.3rem] border border-[var(--line)] bg-[var(--muted)]">
            {selectedAsset ? (
              <Image
                alt={selectedAsset.altText || selectionLabel}
                className="object-cover"
                fill
                sizes="220px"
                src={selectedAsset.thumbnailUrl}
              />
            ) : (
              <div className="admin-gallery-list-row__placeholder h-full">
                <ImageIcon aria-hidden="true" size={20} />
                <span>Pick a cover</span>
              </div>
            )}
          </div>
          <div className="grid content-start gap-3">
            <span className="status-pill">{selectionLabel}</span>
            {selectedAsset ? (
              <>
                <p className="text-sm leading-7 text-[var(--muted-foreground)]">
                  {selectedAsset.publicId}
                </p>
                <a
                  className="queue-link"
                  href={selectedAsset.secureUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open original asset
                </a>
              </>
            ) : (
              <p className="text-sm leading-7 text-[var(--muted-foreground)]">
                No image is linked yet. You can pick from the library or upload a
                new asset from the media workspace.
              </p>
            )}
          </div>
        </div>
      </div>

      {isOpen ? (
        <div className="admin-media-drawer" role="presentation">
          <button
            aria-label="Close media picker"
            className="admin-media-drawer__backdrop"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <aside
            aria-labelledby="event-media-picker-title"
            aria-modal="true"
            className="admin-media-drawer__panel"
            role="dialog"
          >
            <div className="admin-media-drawer__header">
              <div>
                <p className="admin-section-label">Media library</p>
                <h2 className="admin-card-row__title" id="event-media-picker-title">
                  Choose an event cover
                </h2>
              </div>
              <button
                className="admin-icon-button"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X size={16} />
                <span className="sr-only">Close</span>
              </button>
            </div>

            <div className="grid gap-4">
              <label className="input-label">
                Search media
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                    size={16}
                  />
                  <input
                    className="pl-10"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Title or Cloudinary path"
                    value={query}
                  />
                </div>
              </label>

              {error ? (
                <p className="flash-panel" data-tone="error">
                  {error}
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {pickerData.items.map((asset) => (
                  <button
                    className="group overflow-hidden rounded-[1.2rem] border border-[var(--line)] bg-[var(--card)] text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                    key={asset.id}
                    onClick={() => {
                      setSelectedAsset(asset);
                      setIsOpen(false);
                    }}
                    type="button"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-[var(--muted)]">
                      <Image
                        alt={asset.altText || asset.title || asset.publicId}
                        className="object-cover transition duration-500 group-hover:scale-105"
                        fill
                        sizes="280px"
                        src={asset.thumbnailUrl}
                      />
                    </div>
                    <div className="grid gap-2 p-4">
                      <p className="line-clamp-1 text-sm font-semibold">
                        {asset.title || asset.publicId}
                      </p>
                      <p className="line-clamp-2 text-xs leading-5 text-[var(--muted-foreground)]">
                        {asset.publicId}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {!pickerData.items.length && !pending ? (
                <div className="empty-state">
                  No media assets matched this search.
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted-foreground)]">
                <span>
                  {pending
                    ? "Updating media library..."
                    : `${pickerData.totalItems} asset${pickerData.totalItems === 1 ? "" : "s"} found`}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="secondary-button"
                    disabled={pickerData.page <= 1 || pending}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    type="button"
                  >
                    Previous
                  </button>
                  <span className="status-pill">
                    Page {pickerData.page} / {pickerData.totalPages}
                  </span>
                  <button
                    className="secondary-button"
                    disabled={pickerData.page >= pickerData.totalPages || pending}
                    onClick={() =>
                      setPage((current) =>
                        Math.min(pickerData.totalPages, current + 1)
                      )
                    }
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="flex justify-between gap-3">
                <a
                  className="queue-link"
                  href="/admin/content/media"
                  rel="noreferrer"
                  target="_blank"
                >
                  Open media workspace
                  <ExternalLink aria-hidden="true" className="ml-1 inline" size={14} />
                </a>
                <button
                  className="admin-btn admin-btn--ghost"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

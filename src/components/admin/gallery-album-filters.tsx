"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type GalleryAlbumFiltersProps = {
  query: string;
  status: string;
  year: string;
  years: number[];
};

function updateParams(
  currentParams: URLSearchParams,
  updates: Record<string, string>
) {
  const nextParams = new URLSearchParams(currentParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }
  }

  nextParams.delete("page");

  return nextParams;
}

export function GalleryAlbumFilters({
  query,
  status,
  year,
  years,
}: GalleryAlbumFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [queryValue, setQueryValue] = useState(query);

  useEffect(() => {
    setQueryValue(query);
  }, [query]);

  useEffect(() => {
    if (queryValue === query) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextParams = updateParams(searchParams, { q: queryValue.trim() });
      const queryString = nextParams.toString();

      startTransition(() => {
        router.replace(queryString ? `${pathname}?${queryString}` : pathname);
      });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [pathname, query, queryValue, router, searchParams]);

  function updateFilter(key: "status" | "year", value: string) {
    const nextParams = updateParams(searchParams, { [key]: value });
    const queryString = nextParams.toString();

    startTransition(() => {
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    });
  }

  return (
    <section className="admin-review-card">
      <form action="/admin/content/gallery" className="admin-gallery-filter-bar">
        <label className="input-label">
          Search
          <input
            name="q"
            onChange={(event) => setQueryValue(event.target.value)}
            placeholder="Album title, category, or slug"
            value={queryValue}
          />
        </label>
        <label className="input-label">
          Status
          <select
            name="status"
            onChange={(event) => updateFilter("status", event.target.value)}
            value={status}
          >
            <option value="">All</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="input-label">
          Year
          <select
            name="year"
            onChange={(event) => updateFilter("year", event.target.value)}
            value={year}
          >
            <option value="">All</option>
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="admin-gallery-filter-bar__status" aria-live="polite">
          {isPending ? "Updating..." : "Auto filters"}
        </div>
      </form>
    </section>
  );
}

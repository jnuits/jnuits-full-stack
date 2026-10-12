"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";

// Server-rendered filters stay inert until React can capture their first edit.
const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

type GalleryArchiveFiltersProps = {
  categories: string[];
  category: string;
  query: string;
  year: string;
  years: number[];
};

function toLabel(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function updateParams(
  currentParams: { toString: () => string },
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

export function GalleryArchiveFilters({
  categories,
  category,
  query,
  year,
  years,
}: GalleryArchiveFiltersProps) {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot
  );
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [queryValue, setQueryValue] = useState(query);
  const debounceRef = useRef<number | null>(null);

  function replaceWith(nextParams: URLSearchParams) {
    const queryString = nextParams.toString();

    startTransition(() => {
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    });
  }

  function getCurrentParams() {
    return new URLSearchParams(
      typeof window === "undefined"
        ? searchParams.toString()
        : window.location.search
    );
  }

  function updateFilter(key: "category" | "year", value: string) {
    replaceWith(updateParams(getCurrentParams(), { [key]: value }));
  }

  function updateQuery(value: string) {
    setQueryValue(value);

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      replaceWith(updateParams(getCurrentParams(), { q: value.trim() }));
    }, 320);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <section aria-busy={!hydrated || isPending} className="gallery-filter-panel">
      <div className="gallery-filter-panel__grid">
        <label className="input-label">
          Search albums
          <input
            disabled={!hydrated}
            name="q"
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Search by event, caption, category, or year"
            value={queryValue}
          />
        </label>
        <label className="input-label">
          Year
          <select
            disabled={!hydrated}
            name="year"
            onChange={(event) => updateFilter("year", event.target.value)}
            value={year}
          >
            <option value="">All years</option>
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="input-label">
          Category
          <select
            disabled={!hydrated}
            name="category"
            onChange={(event) => updateFilter("category", event.target.value)}
            value={category}
          >
            <option value="">All categories</option>
            {categories.map((option) => (
              <option key={option} value={option}>
                {toLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <div className="gallery-filter-panel__status" aria-live="polite">
          {!hydrated ? "Loading filters..." : isPending ? "Updating archive..." : "Auto-filtering"}
        </div>
      </div>
    </section>
  );
}

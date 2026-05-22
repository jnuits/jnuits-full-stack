"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  toEventCategoryLabel,
  type EventArchiveView,
} from "@/lib/content/events-shared";

type EventArchiveFiltersProps = {
  categories: string[];
  categoryCounts?: Array<{
    category: string;
    count: number;
  }>;
  category: string;
  query: string;
  view: EventArchiveView;
};

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

export function EventArchiveFilters({
  categories,
  categoryCounts = [],
  category,
  query,
  view,
}: EventArchiveFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [queryValue, setQueryValue] = useState(query);
  const debounceRef = useRef<number | null>(null);

  function currentParams() {
    return new URLSearchParams(
      typeof window === "undefined"
        ? searchParams.toString()
        : window.location.search
    );
  }

  function replaceWith(params: URLSearchParams) {
    const queryString = params.toString();

    startTransition(() => {
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    });
  }

  function updateFilter(key: "category" | "view", value: string) {
    replaceWith(updateParams(currentParams(), { [key]: value }));
  }

  function updateQuery(value: string) {
    setQueryValue(value);

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      replaceWith(updateParams(currentParams(), { q: value.trim() }));
    }, 280);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const countsByCategory = new Map(
    categoryCounts.map((option) => [option.category, option.count])
  );

  return (
    <section className="gallery-filter-panel event-filter-panel">
      <span aria-live="polite" className="sr-only">
        {isPending ? "Updating events." : ""}
      </span>
      {/* UX-FIX: Filter bar fragmentation */}
      <div className="gallery-filter-panel__grid event-filter-panel__grid">
        <div className="event-filter-panel__view">
          <span className="input-label">Archive view</span>
          <div className="flex flex-wrap gap-2">
            {(["upcoming", "past"] as const).map((option) => (
              <button
                aria-pressed={view === option}
                className={view === option ? "primary-button" : "secondary-button"}
                key={option}
                onClick={() => updateFilter("view", option)}
                type="button"
              >
                {option === "upcoming" ? "Upcoming" : "Past"}
              </button>
            ))}
          </div>
        </div>
        <div className="event-filter-panel__controls">
          <label className="input-label">
            Search events
            <input
              name="q"
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Search by title, venue, summary, or category"
              value={queryValue}
            />
          </label>
          <label className="input-label">
            Category
            <select
              name="category"
              onChange={(event) => updateFilter("category", event.target.value)}
              value={category}
            >
              <option value="">All categories</option>
              {/* UX-FIX: Category filter counts */}
              {categories.map((option) => (
                <option key={option} value={option}>
                  {toEventCategoryLabel(option)} ({countsByCategory.get(option) || 0})
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </section>
  );
}

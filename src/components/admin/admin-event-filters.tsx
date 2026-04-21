"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toEventCategoryLabel } from "@/lib/content/events-shared";

type AdminEventFiltersProps = {
  categories: string[];
  category: string;
  query: string;
  status: string;
  timeframe: string;
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

export function AdminEventFilters({
  categories,
  category,
  query,
  status,
  timeframe,
}: AdminEventFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [queryValue, setQueryValue] = useState(query);
  const debounceRef = useRef<number | null>(null);

  function replaceWith(params: URLSearchParams) {
    const queryString = params.toString();

    startTransition(() => {
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    });
  }

  function currentParams() {
    return new URLSearchParams(
      typeof window === "undefined"
        ? searchParams.toString()
        : window.location.search
    );
  }

  function updateFilter(
    key: "category" | "status" | "timeframe",
    value: string
  ) {
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

  return (
    <section className="admin-review-card">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_200px_200px_200px_auto] xl:items-end">
        <label className="input-label">
          Search
          <input
            name="q"
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Event title, venue, or slug"
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
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="input-label">
          Timeframe
          <select
            name="timeframe"
            onChange={(event) => updateFilter("timeframe", event.target.value)}
            value={timeframe}
          >
            <option value="all">All</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </select>
        </label>
        <label className="input-label">
          Category
          <select
            name="category"
            onChange={(event) => updateFilter("category", event.target.value)}
            value={category}
          >
            <option value="">All</option>
            {categories.map((option) => (
              <option key={option} value={option}>
                {toEventCategoryLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm text-[var(--muted-foreground)]" aria-live="polite">
          {isPending ? "Updating queue..." : "Auto-filtering"}
        </div>
      </div>
    </section>
  );
}

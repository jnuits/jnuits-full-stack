"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";

type NoticePublicFiltersProps = {
  categories: string[];
  category: string;
  query: string;
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

export function NoticePublicFilters({
  categories,
  category,
  query,
}: NoticePublicFiltersProps) {
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

  function updateCategory(value: string) {
    const nextParams = updateParams(searchParams, { category: value });
    const queryString = nextParams.toString();

    startTransition(() => {
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    });
  }

  return (
    <form action="/notices" className="notices-filter" role="search">
      <label className="notices-filter__field notices-filter__field--search">
        <span>Search notices</span>
        <div className="notices-filter__input-wrap">
          <Search aria-hidden="true" size={18} />
          <input
            name="q"
            onChange={(event) => setQueryValue(event.target.value)}
            placeholder="Search by title, category, or summary..."
            type="search"
            value={queryValue}
          />
        </div>
      </label>

      <label className="notices-filter__field">
        <span>Category</span>
        <select
          name="category"
          onChange={(event) => updateCategory(event.target.value)}
          value={category}
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <div className="notices-filter__actions">
        <span className="notices-filter-status" aria-live="polite">
          {isPending ? "Updating..." : "Auto filters"}
        </span>
        {query || category ? (
          <Link className="notices-filter-reset" href="/notices">
            <RotateCcw aria-hidden="true" size={15} />
            Clear filters
          </Link>
        ) : null}
      </div>
    </form>
  );
}

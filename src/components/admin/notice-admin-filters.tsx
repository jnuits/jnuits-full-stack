"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

type NoticeAdminFiltersProps = {
  categories: string[];
  category: string;
  query: string;
  status: string;
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

export function NoticeAdminFilters({
  categories,
  category,
  query,
  status,
}: NoticeAdminFiltersProps) {
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

  function updateFilter(key: "category" | "status", value: string) {
    const nextParams = updateParams(searchParams, { [key]: value });
    const queryString = nextParams.toString();

    startTransition(() => {
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    });
  }

  const hasFilters = Boolean(query || status || category);

  return (
    <form action="/admin/content/notices" className="notice-admin-filters">
      <label className="notice-admin-filter-field notice-admin-filter-field--search">
        <span>Search</span>
        <div className="notice-admin-filter-field__input">
          <Search aria-hidden="true" size={15} />
          <input
            name="q"
            onChange={(event) => setQueryValue(event.target.value)}
            placeholder="Search title, slug, category, or summary"
            type="search"
            value={queryValue}
          />
        </div>
      </label>
      <label className="notice-admin-filter-field">
        <span>Status</span>
        <select
          name="status"
          onChange={(event) => updateFilter("status", event.target.value)}
          value={status}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <label className="notice-admin-filter-field">
        <span>Category</span>
        <select
          name="category"
          onChange={(event) => updateFilter("category", event.target.value)}
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
      <div className="notice-admin-filter-actions">
        <span className="notice-admin-filter-status" aria-live="polite">
          {isPending ? "Updating..." : "Auto filters"}
        </span>
        {hasFilters ? (
          <Link className="notice-admin-filter-reset" href="/admin/content/notices">
            Reset filters
          </Link>
        ) : null}
      </div>
    </form>
  );
}

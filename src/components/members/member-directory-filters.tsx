"use client";

import Link from "next/link";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import type {
  MemberDirectorySortKey,
  MemberDirectoryTypeFilter,
} from "@/lib/members/directory";

type DepartmentOption = {
  code: string;
  count: number;
  name: string;
};

type MemberDirectoryFiltersProps = {
  departments: DepartmentOption[];
  filters: {
    department: string;
    search: string;
    sort: MemberDirectorySortKey;
    type: MemberDirectoryTypeFilter;
  };
  pageSize: number;
  typeCounts: {
    all: number;
    alumni: number;
    current: number;
  };
};

const MEMBER_TYPE_OPTIONS: Array<{ key: MemberDirectoryTypeFilter; label: string }> = [
  { key: "all", label: "All members" },
  { key: "current", label: "Current" },
  { key: "alumni", label: "Alumni" },
];

const SORT_OPTIONS: Array<{ value: MemberDirectorySortKey; label: string }> = [
  { value: "name", label: "Name A-Z" },
  { value: "batch", label: "Batch" },
  { value: "joined", label: "Recently joined" },
];

const SEARCH_DEBOUNCE_MS = 300;

type TypeOption = {
  count: number;
  key: MemberDirectoryTypeFilter;
  label: string;
};

function normalizeParams(params: URLSearchParams) {
  if (params.get("type") === "all") params.delete("type");
  if (params.get("department") === "") params.delete("department");
  if (params.get("sort") === "name") params.delete("sort");
  if (params.get("search") === "") params.delete("search");
  if (params.get("page") === "1") params.delete("page");
  params.delete("pageSize");
}

function FilterSelectStack({
  departments,
  filters,
  replaceParams,
  typeOptions,
}: {
  departments: DepartmentOption[];
  filters: MemberDirectoryFiltersProps["filters"];
  replaceParams: (updates: Record<string, string>) => void;
  typeOptions: TypeOption[];
}) {
  return (
    <>
      <label className="grid gap-1.5 text-sm font-semibold text-[var(--foreground)] sm:block">
        <span className="sm:sr-only">Member type</span>
        <select
          className="h-10 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] transition focus:border-[var(--brand-blue)]"
          onChange={(event) => replaceParams({ type: event.target.value })}
          value={filters.type}
        >
          {typeOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label} · {option.count}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-[var(--foreground)] sm:block">
        <span className="sm:sr-only">Department</span>
        <select
          className="h-10 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] transition focus:border-[var(--brand-blue)]"
          onChange={(event) => replaceParams({ department: event.target.value })}
          value={filters.department}
        >
          <option value="">All departments</option>
          {departments.map((department) => (
            <option
              disabled={department.count === 0}
              key={department.code}
              style={{ color: department.count === 0 ? "#9CA3AF" : undefined }}
              value={department.code}
            >
              {department.name} · {department.count}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-[var(--foreground)] sm:block">
        <span className="sm:sr-only">Sort</span>
        <select
          className="h-10 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] transition focus:border-[var(--brand-blue)]"
          onChange={(event) => replaceParams({ sort: event.target.value })}
          value={filters.sort}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export function MemberDirectoryFilters({
  departments,
  filters,
  pageSize,
  typeCounts,
}: MemberDirectoryFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchTimerRef = useRef<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const activeHiddenFilterCount = [
    filters.type !== "all",
    Boolean(filters.department),
    filters.sort !== "name",
  ].filter(Boolean).length;
  const searchBusy = isDebouncing || isPending;
  const typeOptions = MEMBER_TYPE_OPTIONS.map((option) => ({
    ...option,
    count: typeCounts[option.key],
  }));

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [drawerOpen]);

  const replaceParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        const nextValue = value.trim();

        if (nextValue) {
          params.set(key, nextValue);
        } else {
          params.delete(key);
        }
      }

      params.set("page", "1");
      params.set("perPage", String(pageSize));
      normalizeParams(params);

      const queryString = params.toString();
      const nextHref = queryString ? `${pathname}?${queryString}` : pathname;

      startTransition(() => {
        router.replace(nextHref, { scroll: false });
      });
    },
    [pageSize, pathname, router, searchParams]
  );

  function handleSearchChange(value: string) {
    if (searchTimerRef.current) {
      window.clearTimeout(searchTimerRef.current);
    }

    setIsDebouncing(true);
    searchTimerRef.current = window.setTimeout(() => {
      const nextSearch = value.trim();

      if (nextSearch !== filters.search) {
        replaceParams({ search: nextSearch });
      }

      setIsDebouncing(false);
    }, SEARCH_DEBOUNCE_MS);
  }

  return (
    <>
      <form
        aria-busy={searchBusy}
        aria-labelledby="members-filter-title"
        className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--card)] p-3 shadow-[var(--shadow-xs)] sm:grid-cols-[minmax(18rem,1.3fr)_11rem_minmax(14rem,1fr)_11rem_auto] sm:items-center"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="relative">
          <label className="sr-only" htmlFor="dir-search">
            Search by name or ID
          </label>
          <input
            autoComplete="off"
            className="h-10 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 pr-9 text-sm text-[var(--foreground)] transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--brand-blue)]"
            defaultValue={filters.search}
            id="dir-search"
            key={filters.search}
            name="search"
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search name or JnUITS ID"
            type="search"
          />
          {searchBusy ? (
            <Loader2
              aria-hidden="true"
              className="spin absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
              size={15}
            />
          ) : (
            <Search
              aria-hidden="true"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
              size={15}
            />
          )}
        </div>

        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)] sm:hidden"
          onClick={() => setDrawerOpen(true)}
          type="button"
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filters{activeHiddenFilterCount ? ` · ${activeHiddenFilterCount}` : ""}
        </button>

        <div className="hidden sm:contents">
          <FilterSelectStack
            departments={departments}
            filters={filters}
            replaceParams={replaceParams}
            typeOptions={typeOptions}
          />
        </div>

        <Link
          className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--line)] px-4 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)]"
          href="/members"
        >
          Reset
        </Link>
      </form>

      {drawerOpen ? (
        <div className="sm:hidden" role="dialog" aria-modal="true">
          <button
            aria-label="Close filters"
            className="filter-backdrop"
            onClick={() => setDrawerOpen(false)}
            type="button"
          />
          <div className="filter-drawer open">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--foreground)]">Filters</h3>
              <button
                aria-label="Close filters"
                className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--line)]"
                onClick={() => setDrawerOpen(false)}
                type="button"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="grid gap-4">
              <FilterSelectStack
                departments={departments}
                filters={filters}
                replaceParams={replaceParams}
                typeOptions={typeOptions}
              />
              <div className="flex items-center gap-3 pt-1">
                <button
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-[var(--brand-blue)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
                  onClick={() => setDrawerOpen(false)}
                  type="button"
                >
                  Apply
                </button>
                <Link
                  className="text-sm font-semibold text-[var(--brand-blue)] hover:underline"
                  href="/members"
                  onClick={() => setDrawerOpen(false)}
                >
                  Clear all
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

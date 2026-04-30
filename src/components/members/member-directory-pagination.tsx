"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

const PER_PAGE_OPTIONS = [12, 24, 48];

function normalizeParams(params: URLSearchParams) {
  if (params.get("type") === "all") params.delete("type");
  if (params.get("department") === "") params.delete("department");
  if (params.get("sort") === "name") params.delete("sort");
  if (params.get("search") === "") params.delete("search");
  if (params.get("page") === "1") params.delete("page");
  params.delete("pageSize");
}

function buildPages(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages] as const;
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const;
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis-end", totalPages] as const;
}

export function MemberDirectoryPagination({
  currentPage,
  pageSize,
  totalItems,
  totalPages,
}: {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pages = useMemo(
    () => buildPages(currentPage, totalPages),
    [currentPage, totalPages]
  );

  if (totalPages <= 1) {
    return null;
  }

  function hrefForPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    params.set("perPage", String(pageSize));
    normalizeParams(params);
    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }

  function updatePerPage(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("perPage", value);
    params.set("page", "1");
    normalizeParams(params);
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }

  return (
    <nav
      aria-label="Directory pagination"
      className="mt-7 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2">
        <p className="text-sm text-[var(--muted-foreground)]">
          Showing {Math.min(pageSize, totalItems)} of {totalItems}
        </p>
        <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <span>per page</span>
          <select
            className="h-9 w-auto rounded-lg border border-[var(--line)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)]"
            onChange={(event) => updatePerPage(event.target.value)}
            value={pageSize}
          >
            {PER_PAGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {currentPage > 1 ? (
            <Link className="member-page-pill" href={hrefForPage(currentPage - 1)}>
              ← Previous
            </Link>
          ) : (
            <button className="member-page-pill member-page-pill--disabled" disabled type="button">
              ← Previous
            </button>
          )}

          {pages.map((page, index) =>
            typeof page === "number" ? (
              <Link
                aria-current={page === currentPage ? "page" : undefined}
                className="member-page-pill"
                data-active={page === currentPage ? "true" : "false"}
                href={hrefForPage(page)}
                key={page}
              >
                {page}
              </Link>
            ) : (
              <span
                className="px-1 text-sm text-[var(--muted-foreground)]"
                key={`${page}-${index}`}
              >
                …
              </span>
            )
          )}

          {currentPage < totalPages ? (
            <Link className="member-page-pill" href={hrefForPage(currentPage + 1)}>
              Next →
            </Link>
          ) : (
            <button className="member-page-pill member-page-pill--disabled" disabled type="button">
              Next →
            </button>
          )}
        </div>
      ) : null}
    </nav>
  );
}

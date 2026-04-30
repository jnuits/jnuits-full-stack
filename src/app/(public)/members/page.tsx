import Link from "next/link";
import type { Metadata } from "next";
import { GraduationCap, Info, UserCheck, Users } from "lucide-react";

import { MemberDirectoryCard } from "@/components/members/member-directory-card";
import { MemberDirectoryEmptyState } from "@/components/members/member-directory-empty-state";
import { MemberDirectoryErrorState } from "@/components/members/member-directory-error-state";
import { MemberDirectoryFilters } from "@/components/members/member-directory-filters";
import { MemberDirectoryPagination } from "@/components/members/member-directory-pagination";
import { getAppBaseUrl } from "@/lib/env";
import { getPublicMemberDirectory } from "@/lib/members/directory";

export const metadata: Metadata = {
  description:
    "Explore the public directory of Jagannath University IT Society members and alumni.",
  openGraph: {
    description:
      "Explore public JnUITS member and alumni profiles with privacy-aware workplace visibility.",
    siteName: "JnUITS",
    title: "Members & Alumni Directory | JnUITS",
    type: "website",
    url: `${getAppBaseUrl()}/members`,
  },
  title: "Members & Alumni Directory | JnUITS",
};

const STAT_TOOLTIPS = {
  alumni: "Former members who have graduated or left the society",
  current: "Active members with a valid membership in the current term",
  total: "All members who have opted-in to the public directory",
};

function DirectoryStatCard({
  icon: Icon,
  label,
  tooltip,
  value,
}: {
  icon: typeof Users;
  label: string;
  tooltip: string;
  value: number;
}) {
  return (
    <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 shadow-[var(--shadow-xs)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-3xl font-bold leading-none text-[var(--foreground)]">
          {value}
        </p>
        <Icon className="text-[var(--brand-blue)]" size={18} aria-hidden="true" />
      </div>
      <div className="group relative mt-2 inline-flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
          {label}
        </p>
        <button
          aria-label={`${label} information`}
          className="inline-flex size-4 items-center justify-center rounded-full text-[var(--muted-foreground)]"
          type="button"
        >
          <Info size={13} aria-hidden="true" />
        </button>
        <span className="pointer-events-none absolute left-0 top-6 z-10 w-64 rounded-lg bg-slate-950 px-3 py-2 text-left text-xs font-medium leading-5 text-white opacity-0 shadow-lg transition group-focus-within:opacity-100 group-hover:opacity-100 dark:bg-slate-100 dark:text-slate-950">
          {tooltip}
        </span>
      </div>
    </article>
  );
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  let directory;

  try {
    directory = await getPublicMemberDirectory({
      department: sp.department,
      page: sp.page,
      perPage: sp.perPage,
      pageSize: sp.pageSize,
      search: sp.search,
      sort: sp.sort,
      type: sp.type,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(error);
    }

    return <MemberDirectoryErrorState />;
  }

  const { counters, facets, filters, members, pagination } = directory;

  return (
    <main className="shell py-10">
      <section aria-labelledby="members-page-title" className="border-b border-[var(--line)] pb-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h1
              className="font-[family-name:var(--font-heading)] text-4xl font-semibold leading-tight text-[var(--foreground)] sm:text-5xl"
              id="members-page-title"
            >
              Members &amp; alumni directory
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
              Browse public JnUITS profiles with privacy-aware workplace visibility and
              canonical membership IDs.
            </p>
    <div className="shell py-12">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="glass-card px-6 py-8 sm:px-8">
        <span className="eyebrow">Public directory</span>
        <h1 className="section-title mt-4">Members &amp; alumni directory</h1>
        <p className="section-copy mt-4">
          Public identity fields are open; sensitive workplace records are gated by a
          short-lived member verification. Use filters and sort to navigate the directory.
        </p>

        {/* Stats */}
        <div className="mt-6 info-grid">
          <article className="metric-card">
            <p className="text-sm text-[var(--muted-foreground)]">Total listed</p>
            <p className="metric-card__value mt-2">{counters.total}</p>
          </article>
          <article className="metric-card">
            <p className="text-sm text-[var(--muted-foreground)]">Current members</p>
            <p className="metric-card__value mt-2">{counters.current}</p>
          </article>
          <article className="metric-card">
            <p className="text-sm text-[var(--muted-foreground)]">Alumni</p>
            <p className="metric-card__value mt-2">{counters.alumni}</p>
          </article>
        </div>

        {/* Type tabs */}
        <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Member type filter">
          {MEMBER_TYPE_TABS.map((tab) => {
            const count =
              tab.key === "all" ? counters.total
              : tab.key === "current" ? counters.current
              : counters.alumni;
            const active = filters.type === tab.key;
            return (
              <Link
                key={tab.key}
                href={buildHref(base, { type: tab.key, page: "1" })}
                role="tab"
                aria-selected={active}
                className={active ? "primary-button" : "secondary-button"}
              >
                {tab.label}
                <span className="ml-1.5 text-xs opacity-70">({count})</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Filters sidebar ───────────────────────────────────────────────── */}
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <form className="section-band grid gap-4" method="get" action="/members">
          <p className="section-divider">Filters &amp; sort</p>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Search */}
            <label className="input-label">
              Search by name or ID
              <input
                id="dir-search"
                name="search"
                placeholder="e.g. JAKIYA, JnUITS-2026001"
                defaultValue={filters.search}
                autoComplete="off"
              />
            </label>

            {/* Initial letter */}
            <label className="input-label">
              Name starts with
              <select id="dir-letter" name="letter" defaultValue={filters.letter}>
                <option value="">All initials</option>
                {ALPHA.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Department */}
            <label className="input-label">
              Department
              <select id="dir-dept" name="department" defaultValue={filters.department}>
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.code} value={d.code}>{d.name}</option>
                ))}
              </select>
            </label>

            {/* Sort */}
            <label className="input-label">
              Sort by
              <select id="dir-sort" name="sort" defaultValue={filters.sort}>
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Category hidden (synced from tabs) — carry type through form */}
          <input type="hidden" name="type" value={filters.type} />
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={String(pagination.pageSize)} />

          <div className="mt-1 flex flex-wrap gap-3">
            <button id="dir-apply" className="primary-button" type="submit">
              Apply filters
            </button>
            <Link href="/members" className="ghost-button">
              Reset all
            </Link>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex h-9 items-center rounded-full bg-[var(--brand-blue)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-xs)] transition hover:opacity-90"
              href="/portal/profile/edit"
            >
              Verify in member portal
            </Link>
            <Link
              className="inline-flex h-9 items-center rounded-full border border-[var(--line)] bg-transparent px-4 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)]"
              href="/membership-form"
            >
              Check application status
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <DirectoryStatCard
            icon={Users}
            label="Total Listed"
            tooltip={STAT_TOOLTIPS.total}
            value={counters.total}
          />
          <DirectoryStatCard
            icon={UserCheck}
            label="Current Members"
            tooltip={STAT_TOOLTIPS.current}
            value={counters.current}
          />
          <DirectoryStatCard
            icon={GraduationCap}
            label="Alumni"
            tooltip={STAT_TOOLTIPS.alumni}
            value={counters.alumni}
          />
        </div>
      </section>

      <section aria-labelledby="members-filter-title" className="mt-6">
        <h2 className="sr-only" id="members-filter-title">
          Filter members and alumni
        </h2>
        <MemberDirectoryFilters
          departments={facets.departments}
          filters={{
            department: filters.department,
            search: filters.search,
            sort: filters.sort,
            type: filters.type,
          }}
          pageSize={pagination.pageSize}
          typeCounts={facets.types}
        />
      </section>

      <section aria-labelledby="members-listing-title" className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              className="text-xl font-semibold leading-7 text-[var(--foreground)]"
              id="members-listing-title"
            >
              {pagination.totalItems} record{pagination.totalItems === 1 ? "" : "s"} found
            </h2>
            {pagination.totalPages > 1 ? (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Page {pagination.page} of {pagination.totalPages}
              </p>
            ) : null}
          </div>
        </div>

        {members.length === 0 ? (
          <MemberDirectoryEmptyState />
        ) : (
          <div className="members-grid mt-5">
            {members.map((member) => (
              <MemberDirectoryCard key={member.id} member={member} />
            ))}
          </div>
        )}

        <MemberDirectoryPagination
          currentPage={pagination.page}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          totalPages={pagination.totalPages}
        />
      </section>
    </main>
  );
}

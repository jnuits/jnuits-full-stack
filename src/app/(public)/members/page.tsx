import Link from "next/link";
import {
  getPublicMemberDirectory,
  type MemberDirectoryTypeFilter,
  type MemberDirectorySortKey,
} from "@/lib/members/directory";
import { EmptyState } from "@/components/ui/empty-state";

const MEMBER_TYPE_TABS: Array<{ key: MemberDirectoryTypeFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "current", label: "Current" },
  { key: "alumni", label: "Alumni" },
];

const SORT_OPTIONS: Array<{ value: MemberDirectorySortKey; label: string }> = [
  { value: "name", label: "Name (A–Z)" },
  { value: "batch", label: "Batch number" },
  { value: "joined", label: "Recently joined" },
];

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Visibility display helpers */
function visibilityChip(v: "public" | "members-only" | "private") {
  if (v === "public") return { label: "Public", cls: "text-emerald-400" };
  if (v === "private") return { label: "Private", cls: "text-rose-400" };
  return { label: "Members only", cls: "text-amber-400" };
}

function buildHref(base: Record<string, string>, overrides: Record<string, string>): string {
  const p = new URLSearchParams({ ...base, ...overrides });
  // strip defaults
  if (p.get("type") === "all") p.delete("type");
  if (p.get("department") === "") p.delete("department");
  if (p.get("sort") === "name") p.delete("sort");
  if (p.get("letter") === "") p.delete("letter");
  if (p.get("search") === "") p.delete("search");
  if (p.get("pageSize") === "12") p.delete("pageSize");
  const qs = p.toString();
  return qs ? `/members?${qs}` : "/members";
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const directory = await getPublicMemberDirectory({
    type: sp.type,
    search: sp.search,
    letter: sp.letter,
    department: sp.department,
    sort: sp.sort,
    page: sp.page,
    pageSize: sp.pageSize,
  });

  const { filters, pagination, counters, departments, members, viewer } = directory;

  // Build a stable base object for href composition
  const base: Record<string, string> = {
    type: filters.type,
    search: filters.search,
    letter: filters.letter,
    department: filters.department,
    sort: filters.sort,
    pageSize: String(pagination.pageSize),
  };

  return (
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
                placeholder="e.g. JAKIYA, JNUITS-1025"
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
        </form>

        {/* Verification gate info */}
        <article className="section-band">
          <p className="section-divider">Verification gate</p>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.3rem)] leading-[0.98] tracking-[-0.04em]">
            Workplace details follow member privacy policy
          </h2>
          <p className="mt-4 text-sm leading-7 text-[var(--muted-foreground)]">
            Public workplace fields stay visible only when a member marks them public.
            Members-only workplace data appears after directory verification from the
            claimed account.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="detail-chip">
              Signed in: {viewer.signedIn ? "Yes" : "No"}
            </span>
            <span className="detail-chip">
              Directory verified: {viewer.directoryVerified ? "Yes" : "No"}
            </span>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/profile/edit" className="secondary-button">
              Verify in member portal
            </Link>
            <Link href="/membership-form" className="ghost-button">
              Check application status
            </Link>
          </div>
        </article>
      </section>

      {/* ── Alpha quick-jump ──────────────────────────────────────────────── */}
      <section className="mt-6 section-band">
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={buildHref(base, { letter: "", page: "1" })}
            className={`detail-chip transition-colors hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)]${!filters.letter ? " border-[var(--brand-blue)] text-[var(--brand-blue)]" : ""}`}
          >
            All
          </Link>
          {ALPHA.map((l) => (
            <Link
              key={l}
              href={buildHref(base, { letter: l, page: "1" })}
              aria-current={filters.letter === l ? "page" : undefined}
              className={`detail-chip transition-colors hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)]${filters.letter === l ? " border-[var(--brand-blue)] text-[var(--brand-blue)]" : ""}`}
            >
              {l}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Directory listing ─────────────────────────────────────────────── */}
      <section className="mt-6 section-band">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="section-divider">Directory listing</p>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.4rem)] leading-[0.96] tracking-[-0.04em]">
              {pagination.totalItems} record{pagination.totalItems === 1 ? "" : "s"} found
            </h2>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            Page {pagination.page} of {pagination.totalPages}
          </p>
        </div>

        {members.length === 0 ? (
          <EmptyState
            title={
              filters.search || filters.letter || filters.department
                ? "No members matched your filters"
                : "Member directory is being set up"
            }
            description={
              filters.search || filters.letter || filters.department
                ? "Try adjusting your filters or reset to see the full directory."
                : "Our team is onboarding members to the platform. Check back soon."
            }
            actions={[
              { label: "Reset filters", href: "/members", variant: "secondary" },
              { label: "Apply for membership", href: "/membership-form", variant: "ghost" },
            ]}
            className="mt-6"
          />
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {members.map((member) => {
              const chip = visibilityChip(member.workplace.visibility);
              return (
                <article
                  key={member.id}
                  className="application-card flex flex-col gap-4"
                >
                  {/* Name / ID / type */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-[family-name:var(--font-heading)] text-xl leading-tight truncate">
                        {member.fullName}
                      </h3>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                        {member.jnuitsId}
                      </p>
                    </div>
                    <span
                      className="status-pill shrink-0"
                      style={
                        member.memberType === "alumni"
                          ? { background: "color-mix(in oklab,var(--brand-blue) 14%,transparent)", color: "var(--brand-blue)" }
                          : {}
                      }
                    >
                      {member.memberType === "alumni" ? "Alumni" : "Current"}
                    </span>
                  </div>

                  {/* Department + Batch chips */}
                  <div className="flex flex-wrap gap-2">
                    {member.departmentName ? (
                      <span className="detail-chip">{member.departmentName}</span>
                    ) : null}
                    {member.batchNo !== null ? (
                      <span className="detail-chip">Batch {member.batchNo}</span>
                    ) : null}
                  </div>

                  {/* Workplace */}
                  <div className="route-tile mt-auto">
                    <h3 className={`text-xs font-bold uppercase tracking-[0.14em] ${chip.cls}`}>
                      {chip.label}
                    </h3>
                    {member.workplace.visible ? (
                      <p className="mt-1.5 text-sm leading-6 text-[var(--muted-foreground)]">
                        {[member.workplace.designation, member.workplace.currentOrganization]
                          .filter(Boolean)
                          .join(" · ") || "No workplace details published."}
                        {member.workplace.workLocation
                          ? ` (${member.workplace.workLocation})`
                          : ""}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-sm leading-6 text-[var(--muted-foreground)]">
                        {member.workplace.visibility === "private"
                          ? "This member has kept workplace details private."
                          : "Visible after directory verification in the member portal."}
                      </p>
                    )}
                  </div>

                  {/* Links */}
                  {(member.linkedinUrl || member.websiteUrl) ? (
                    <div className="flex flex-wrap gap-2">
                      {member.linkedinUrl ? (
                        <Link href={member.linkedinUrl} target="_blank" className="secondary-button">
                          LinkedIn ↗
                        </Link>
                      ) : null}
                      {member.websiteUrl ? (
                        <Link href={member.websiteUrl} target="_blank" className="secondary-button">
                          Website ↗
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--muted-foreground)]">
            Showing {Math.min(pagination.pageSize, members.length)} of {pagination.totalItems} records
          </p>
          <div className="flex gap-2">
            {pagination.hasPrevious ? (
              <Link
                href={buildHref(base, { page: String(pagination.page - 1) })}
                className="secondary-button"
              >
                ← Previous
              </Link>
            ) : (
              <span className="secondary-button pointer-events-none opacity-50">← Previous</span>
            )}
            {pagination.hasNext ? (
              <Link
                href={buildHref(base, { page: String(pagination.page + 1) })}
                className="secondary-button"
              >
                Next →
              </Link>
            ) : (
              <span className="secondary-button pointer-events-none opacity-50">Next →</span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

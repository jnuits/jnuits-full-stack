import Link from "next/link";
import {
  getPublicMemberDirectory,
  type MemberDirectoryTypeFilter,
} from "@/lib/members/directory";

const directoryTabs: Array<{
  key: MemberDirectoryTypeFilter;
  label: string;
}> = [
  { key: "all", label: "All members" },
  { key: "current", label: "Current members" },
  { key: "alumni", label: "Alumni" },
];

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function buildMembersHref(params: URLSearchParams) {
  const query = params.toString();
  return query ? `/members?${query}` : "/members";
}

function workplaceVisibilityLabel(value: "public" | "members-only" | "private") {
  if (value === "public") {
    return "Public workplace profile";
  }

  if (value === "private") {
    return "Private workplace profile";
  }

  return "Members-only workplace profile";
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const directory = await getPublicMemberDirectory({
    type: resolvedSearchParams.type,
    search: resolvedSearchParams.search,
    letter: resolvedSearchParams.letter,
    page: resolvedSearchParams.page,
    pageSize: resolvedSearchParams.pageSize,
  });

  const baseFilterParams = new URLSearchParams();

  if (directory.filters.search) {
    baseFilterParams.set("search", directory.filters.search);
  }

  if (directory.filters.letter) {
    baseFilterParams.set("letter", directory.filters.letter);
  }

  baseFilterParams.set("pageSize", String(directory.pagination.pageSize));

  const previousParams = new URLSearchParams(baseFilterParams);
  const nextParams = new URLSearchParams(baseFilterParams);

  if (directory.filters.type !== "all") {
    previousParams.set("type", directory.filters.type);
    nextParams.set("type", directory.filters.type);
  }

  previousParams.set("page", String(directory.pagination.page - 1));
  nextParams.set("page", String(directory.pagination.page + 1));

  return (
    <div className="shell py-12">
      <section className="glass-card px-6 py-8 sm:px-8">
        <span className="eyebrow">Public directory</span>
        <h1 className="section-title mt-4">Members and alumni directory</h1>
        <p className="section-copy mt-4">
          Public identity fields remain open, while sensitive workplace records stay
          behind a short-lived member verification gate. Use filters to find members,
          alumni, and specific initials quickly.
        </p>

        <div className="mt-6 info-grid">
          <article className="metric-card">
            <p className="text-sm text-[var(--muted)]">Total listed</p>
            <p className="metric-card__value mt-2">{directory.counters.total}</p>
          </article>
          <article className="metric-card">
            <p className="text-sm text-[var(--muted)]">Current members</p>
            <p className="metric-card__value mt-2">{directory.counters.current}</p>
          </article>
          <article className="metric-card">
            <p className="text-sm text-[var(--muted)]">Alumni</p>
            <p className="metric-card__value mt-2">{directory.counters.alumni}</p>
          </article>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {directoryTabs.map((tab) => {
            const tabParams = new URLSearchParams(baseFilterParams);

            if (tab.key !== "all") {
              tabParams.set("type", tab.key);
            } else {
              tabParams.delete("type");
            }

            tabParams.set("page", "1");

            const totalForTab =
              tab.key === "all"
                ? directory.counters.total
                : tab.key === "current"
                  ? directory.counters.current
                  : directory.counters.alumni;

            const isActive = directory.filters.type === tab.key;

            return (
              <Link
                key={tab.key}
                href={buildMembersHref(tabParams)}
                className={isActive ? "primary-button" : "secondary-button"}
              >
                {tab.label} ({totalForTab})
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <form className="section-band grid gap-4" method="get">
          <p className="section-divider">Directory filters</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="input-label">
              Search by name or ID
              <input
                name="search"
                placeholder="e.g. JAKIYA, JNUITS-1025"
                defaultValue={directory.filters.search}
              />
            </label>
            <label className="input-label">
              Initial letter
              <select name="letter" defaultValue={directory.filters.letter}>
                <option value="">All initials</option>
                {alphabet.map((letter) => (
                  <option key={letter} value={letter}>
                    {letter}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="input-label sm:max-w-xs">
            Category
            <select name="type" defaultValue={directory.filters.type}>
              <option value="all">All members</option>
              <option value="current">Current members</option>
              <option value="alumni">Alumni</option>
            </select>
          </label>

          <input type="hidden" name="page" value="1" />
          <input
            type="hidden"
            name="pageSize"
            value={String(directory.pagination.pageSize)}
          />

          <div className="mt-2 flex flex-wrap gap-3">
            <button className="primary-button" type="submit">
              Apply filters
            </button>
            <Link href="/members" className="ghost-button">
              Reset
            </Link>
          </div>
        </form>

        <article className="section-band">
          <p className="section-divider">Verification gate</p>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.3rem)] leading-[0.98] tracking-[-0.04em]">
            Workplace details follow member privacy policy
          </h2>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
            Public workplace fields stay visible only when a member marks them public.
            Members-only workplace data appears after directory verification from the
            claimed account.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="detail-chip">
              Signed in: {directory.viewer.signedIn ? "Yes" : "No"}
            </span>
            <span className="detail-chip">
              Directory verified: {directory.viewer.directoryVerified ? "Yes" : "No"}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/profile/edit" className="secondary-button">
              Verify in member portal
            </Link>
            <Link href="/membership-form" className="ghost-button">
              Check legacy application status
            </Link>
          </div>
        </article>
      </section>

      <section className="mt-8 section-band">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="section-divider">Directory listing</p>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.4rem)] leading-[0.96] tracking-[-0.04em]">
              {directory.pagination.totalItems} record
              {directory.pagination.totalItems === 1 ? "" : "s"} matched
            </h2>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Page {directory.pagination.page} of {directory.pagination.totalPages}
          </p>
        </div>

        {directory.members.length === 0 ? (
          <div className="empty-state mt-6">
            No directory records matched the current filters.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {directory.members.map((member) => (
              <article key={member.id} className="application-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-[family-name:var(--font-heading)] text-2xl leading-tight">
                      {member.fullName}
                    </h3>
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                      {member.jnuitsId}
                    </p>
                  </div>
                  <span className="status-pill">
                    {member.memberType === "alumni" ? "Alumni" : "Current"}
                  </span>
                </div>

                <div className="mt-5 route-grid">
                  <div className="route-tile">
                    <h3>Department</h3>
                    <p>{member.departmentName || "Not published"}</p>
                  </div>
                  <div className="route-tile">
                    <h3>Batch</h3>
                    <p>{member.batchNo ?? "Not published"}</p>
                  </div>
                </div>

                <div className="mt-4 route-tile">
                  <h3>{workplaceVisibilityLabel(member.workplace.visibility)}</h3>
                  {member.workplace.visible ? (
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      {[member.workplace.designation, member.workplace.currentOrganization]
                        .filter((value) => Boolean(value))
                        .join(" • ") || "No workplace details published."}
                      {member.workplace.workLocation
                        ? ` (${member.workplace.workLocation})`
                        : ""}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      {member.workplace.visibility === "private"
                        ? "This member has kept workplace fields private."
                        : "Visible only after directory verification in the member portal."}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {member.linkedinUrl ? (
                    <Link
                      href={member.linkedinUrl}
                      target="_blank"
                      className="secondary-button"
                    >
                      LinkedIn
                    </Link>
                  ) : null}
                  {member.websiteUrl ? (
                    <Link
                      href={member.websiteUrl}
                      target="_blank"
                      className="secondary-button"
                    >
                      Website
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--muted)]">
            Alumni workplace change requests and lifecycle history are available from
            each member&apos;s claimed portal profile.
          </p>
          <div className="flex gap-2">
            {directory.pagination.hasPrevious ? (
              <Link href={buildMembersHref(previousParams)} className="secondary-button">
                Previous
              </Link>
            ) : (
              <span className="secondary-button pointer-events-none opacity-60">
                Previous
              </span>
            )}

            {directory.pagination.hasNext ? (
              <Link href={buildMembersHref(nextParams)} className="secondary-button">
                Next
              </Link>
            ) : (
              <span className="secondary-button pointer-events-none opacity-60">
                Next
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

"use client";

import { Loader2, Search, X } from "lucide-react";
import { useState, useTransition } from "react";

import { searchOnboardingMembersAction } from "@/app/admin/onboarding/actions";

export type CommitteeMemberSearchOption = {
  email: null | string;
  fullName: string;
  id: string;
  jnuitsId: null | string;
  lifecycleStatus: string;
  memberType: string;
};

type SearchResult = {
  members: CommitteeMemberSearchOption[];
  page: number;
  pageSize: number;
  total: number;
};

type CommitteeMemberSearchProps = {
  initialMember?: CommitteeMemberSearchOption | null;
  name?: string;
  onSelect?: (member: CommitteeMemberSearchOption | null) => void;
};

function isSearchResult(value: unknown): value is SearchResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<SearchResult>;
  return (
    Array.isArray(result.members) &&
    typeof result.page === "number" &&
    typeof result.pageSize === "number" &&
    typeof result.total === "number"
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || "J"}${parts.at(-1)?.[0] || "S"}`.toUpperCase();
}

function lifecycleLabel(member: CommitteeMemberSearchOption) {
  const value = member.lifecycleStatus || member.memberType;
  return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

export function CommitteeMemberSearch({
  initialMember = null,
  name = "memberId",
  onSelect,
}: CommitteeMemberSearchProps) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selected, setSelected] = useState<CommitteeMemberSearchOption | null>(
    initialMember
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function choose(member: CommitteeMemberSearchOption | null) {
    setSelected(member);
    onSelect?.(member);
  }

  function search(page: number, nextQuery = submittedQuery || query.trim()) {
    const normalizedQuery = nextQuery.trim();
    setError(null);
    setSubmittedQuery(normalizedQuery);
    startTransition(async () => {
      const response = await searchOnboardingMembersAction({
        operationType: "committee_roster_import",
        page,
        pageSize: 20,
        query: normalizedQuery,
      });
      if (!response.ok || !isSearchResult(response.data)) {
        setError(response.message || "Unable to search members.");
        return;
      }
      setResult(response.data);
    });
  }

  const pageCount = result
    ? Math.max(1, Math.ceil(result.total / Math.max(1, result.pageSize)))
    : 1;

  return (
    <div className="grid min-w-0 gap-3">
      <input name={name} type="hidden" value={selected?.id || ""} />

      {selected ? (
        <div className="relative rounded-xl border border-border bg-muted/30 p-3">
          <button
            aria-label="Clear selected member"
            className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted"
            onClick={() => choose(null)}
            type="button"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
          <div className="flex items-center gap-3 pr-9">
            <span
              aria-hidden="true"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
            >
              {initials(selected.fullName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{selected.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {selected.jnuitsId || "No JnUITS ID"} · {selected.email || "No email"}
              </p>
              <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {lifecycleLabel(selected)}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="flex flex-col gap-2 sm:flex-row"
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search members</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            aria-label="Search members"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            maxLength={100}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              search(1, query);
            }}
            placeholder="Name, JnUITS ID, or email"
            type="search"
            value={query}
          />
        </label>
        <button
          className="admin-btn admin-btn--secondary"
          disabled={isPending}
          onClick={() => search(1, query)}
          type="button"
        >
          {isPending ? <Loader2 aria-hidden="true" className="animate-spin" size={15} /> : null}
          Search
        </button>
      </div>

      {error ? <p className="portal-message portal-message--error" role="alert">{error}</p> : null}

      {result ? (
        <div className="overflow-hidden rounded-lg border border-border" aria-label="Member search results">
          {result.members.length > 0 ? (
            result.members.map((member) => (
              <button
                aria-label={`Select ${member.fullName}`}
                className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left transition-colors last:border-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                key={member.id}
                onClick={() => choose(member)}
                type="button"
              >
                <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  {initials(member.fullName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{member.fullName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {member.jnuitsId || "No JnUITS ID"} · {member.email || "No email"}
                  </span>
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {lifecycleLabel(member)}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">No members match this search.</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/20 px-3 py-2">
            <p aria-live="polite" className="text-xs text-muted-foreground">
              {`Page ${result.page} of ${pageCount} · ${result.total} result${result.total === 1 ? "" : "s"}`}
            </p>
            <div className="flex gap-2">
              <button
                className="admin-btn admin-btn--ghost"
                disabled={isPending || result.page <= 1}
                onClick={() => search(result.page - 1)}
                type="button"
              >
                Previous page
              </button>
              <button
                className="admin-btn admin-btn--ghost"
                disabled={isPending || result.page >= pageCount}
                onClick={() => search(result.page + 1)}
                type="button"
              >
                Next page
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Search runs on the server and returns 20 members at a time.
        </p>
      )}
    </div>
  );
}

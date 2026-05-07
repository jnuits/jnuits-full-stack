import { Info } from "lucide-react";

export function IdentityBoundaryNotice() {
  return (
    <aside className="my-16 flex items-start gap-4 rounded-2xl border border-blue-200/50 bg-blue-50/40 px-6 py-5 dark:border-blue-800/30 dark:bg-blue-950/15">
      <div className="mt-0.5 flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
        <Info
          aria-hidden="true"
          className="text-blue-600 dark:text-blue-400"
          size={16}
        />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          Advisor identities are separate from members
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Teacher advisors use advisor profiles and advisor portal IDs
          (JNUITS-CA, JNUITS-MOD, JNUITS-RA prefixes). Executive committee
          members use member-linked JnUITS IDs and remain part of the
          membership system.
        </p>
      </div>
    </aside>
  );
}

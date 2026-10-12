import { CalendarDays, ExternalLink } from "lucide-react";

import type { PublicAdvisorProfile } from "@/lib/committee/public-contracts";
import {
  formatAdvisorDisplayName,
  formatAdvisorTenure,
  getInitials,
  isInternalNote,
} from "@/lib/committee-utils";

function cn(...classes: Array<false | null | string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AdvisorCompactCard({
  advisor,
}: {
  advisor: PublicAdvisorProfile;
}) {
  const displayName = formatAdvisorDisplayName(advisor);
  const safeNote =
    advisor.statusNote && !isInternalNote(advisor.statusNote)
      ? advisor.statusNote
      : null;

  return (
    <article className="rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300/50 hover:shadow-sm">
      <AdvisorAvatar advisor={advisor} />
      <h3 className="mt-3 text-base font-semibold text-foreground">
        {displayName}
      </h3>
      <span className="mt-2 inline-flex rounded-full border border-amber-300/50 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
        Honorable Advisor
      </span>
      {advisor.designation || advisor.department ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {[advisor.designation, advisor.department].filter(Boolean).join(" - ")}
        </p>
      ) : null}
      {advisor.advisorJnuitsId ? (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          {advisor.advisorJnuitsId}
        </p>
      ) : null}
      {safeNote ? (
        <p className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {safeNote}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays aria-hidden="true" size={11} />
          {formatAdvisorTenure(advisor)}
        </span>
        {advisor.jnuProfileUrl ? (
          <a
            aria-label={`View JnU profile for ${displayName} (opens in new tab)`}
            className="inline-flex min-h-11 items-center gap-1 text-[10px] text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            href={advisor.jnuProfileUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" size={10} />
            <span>JnU Profile</span>
            <span className="sr-only">(opens in new tab)</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}

function AdvisorAvatar({ advisor }: { advisor: PublicAdvisorProfile }) {
  const displayName = formatAdvisorDisplayName(advisor);
  const className =
    "size-11 rounded-xl border border-amber-200/50 bg-amber-50 text-sm font-bold text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300";

  if (advisor.avatarUrl) {
    return (
      // Public profile avatars are already optimized by the CMS/upload flow.
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={displayName} className={cn(className, "object-cover")} src={advisor.avatarUrl} />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn("flex items-center justify-center font-bold", className)}
    >
      {getInitials(displayName)}
    </div>
  );
}

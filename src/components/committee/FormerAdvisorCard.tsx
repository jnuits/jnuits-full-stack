import { CalendarDays, ExternalLink } from "lucide-react";

import type { PublicAdvisorProfile } from "@/lib/committee/public";
import {
  formatAdvisorDisplayName,
  formatAdvisorTenure,
  getInitials,
  isInternalNote,
} from "@/lib/committee-utils";

function cn(...classes: Array<false | null | string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function FormerAdvisorCard({
  advisor,
}: {
  advisor: PublicAdvisorProfile;
}) {
  const displayName = formatAdvisorDisplayName(advisor);
  const safeBio =
    advisor.bio && !isInternalNote(advisor.bio) ? advisor.bio : null;
  const safeNote =
    advisor.statusNote && !isInternalNote(advisor.statusNote)
      ? advisor.statusNote
      : null;
  const tenure = formatAdvisorTenure(advisor);

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <AdvisorAvatar advisor={advisor} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">
              {displayName}
            </h4>
            {advisor.formerTitle ? (
              <span className="whitespace-nowrap rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {advisor.formerTitle}
              </span>
            ) : null}
          </div>
          {advisor.designation ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {advisor.designation}
            </p>
          ) : null}
          {advisor.advisorJnuitsId ? (
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/50">
              {advisor.advisorJnuitsId}
            </p>
          ) : null}
        </div>
      </div>

      {safeBio ? (
        <p className="mt-4 line-clamp-2 text-xs leading-relaxed text-foreground/70">
          {safeBio}
        </p>
      ) : null}

      {safeNote ? (
        <p className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {safeNote}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/50 pt-4">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays aria-hidden="true" size={11} />
          {advisor.dateConfidence === "estimated"
            ? `${tenure} - Estimated`
            : tenure}
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
            JnU Profile
          </a>
        ) : null}
      </div>
    </article>
  );
}

function AdvisorAvatar({ advisor }: { advisor: PublicAdvisorProfile }) {
  const displayName = formatAdvisorDisplayName(advisor);
  const className =
    "size-12 rounded-xl bg-muted text-sm font-bold text-muted-foreground [filter:grayscale(0.4)]";

  if (advisor.avatarUrl) {
    return (
      // Public profile avatars are already optimized by the CMS/upload flow.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={displayName}
        className={cn(className, "flex-shrink-0 object-cover")}
        src={advisor.avatarUrl}
      />
    );
  }

  return (
    <div
      aria-label={`${displayName} advisor portrait`}
      className={cn(
        "flex flex-shrink-0 items-center justify-center",
        className
      )}
      role="img"
    >
      {getInitials(displayName)}
    </div>
  );
}

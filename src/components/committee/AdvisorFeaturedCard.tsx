import { CalendarDays, ExternalLink } from "lucide-react";

import type { PublicAdvisorProfile } from "@/lib/committee/public-contracts";
import {
  formatAdvisorDisplayName,
  formatAdvisorTenure,
  getInitials,
  isInternalNote,
} from "@/lib/committee-utils";

type FeaturedTone = "chief" | "moderator" | "honorable";

const TONE = {
  chief: {
    accent: "text-purple-600 dark:text-purple-400",
    avatar:
      "size-16 sm:size-20 rounded-2xl border-2 border-purple-200/60 bg-purple-100 text-2xl text-purple-600 dark:border-purple-700/40 dark:bg-purple-900/40 dark:text-purple-400",
    background:
      "border-purple-200/60 bg-gradient-to-br from-purple-50/60 to-background dark:border-purple-800/30 dark:from-purple-950/20 dark:to-background",
    blockquote: "border-purple-300/60 dark:border-purple-600/40",
    decoration: "bg-purple-400/5",
    line: "bg-purple-400",
    link: "text-purple-600 dark:text-purple-400",
    label: "Chief Advisor",
  },
  moderator: {
    accent: "text-blue-600 dark:text-blue-400",
    avatar:
      "size-16 sm:size-20 rounded-2xl border-2 border-blue-200/60 bg-blue-100 text-xl text-blue-600 dark:border-blue-700/40 dark:bg-blue-900/40 dark:text-blue-400",
    background:
      "border-blue-200/60 bg-gradient-to-br from-blue-50/60 to-background dark:border-blue-800/30 dark:from-blue-950/20 dark:to-background",
    blockquote: "border-blue-300/60 dark:border-blue-600/40",
    decoration: "bg-blue-400/5",
    line: "bg-blue-400",
    link: "text-blue-600 dark:text-blue-400",
    label: "Moderator / Mentor",
  },
  honorable: {
    accent: "text-amber-700 dark:text-amber-400",
    avatar:
      "size-16 sm:size-20 rounded-2xl border-2 border-amber-200/60 bg-amber-100 text-xl text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/40 dark:text-amber-400",
    background:
      "border-amber-200/60 bg-gradient-to-br from-amber-50/60 to-background dark:border-amber-800/30 dark:from-amber-950/20 dark:to-background",
    blockquote: "border-amber-300/60 dark:border-amber-600/40",
    decoration: "bg-amber-400/5",
    line: "bg-amber-400",
    link: "text-amber-700 dark:text-amber-400",
    label: "Honorable Advisor",
  },
} satisfies Record<FeaturedTone, Record<string, string>>;

function cn(...classes: Array<false | null | string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AdvisorFeaturedCard({
  advisor,
  tone,
}: {
  advisor: PublicAdvisorProfile;
  tone: FeaturedTone;
}) {
  const style = TONE[tone];
  const displayName = formatAdvisorDisplayName(advisor);
  const tenure = formatAdvisorTenure(advisor);
  const safeBio =
    advisor.bio && !isInternalNote(advisor.bio) ? advisor.bio : null;
  const safeNote =
    advisor.statusNote && !isInternalNote(advisor.statusNote)
      ? advisor.statusNote
      : null;

  return (
    <article
      className={cn(
        "relative flex h-full w-full flex-col justify-between overflow-hidden rounded-3xl border p-5 sm:p-7 lg:p-8",
        style.background
      )}
    >
      <div>
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute right-0 top-0 size-64 -translate-y-20 translate-x-20 rounded-full",
            style.decoration
          )}
        />

        <p
          className={cn(
            "mb-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em]",
            style.accent
          )}
        >
          <span className={cn("h-px w-5", style.line)} />
          {style.label}
        </p>

        <div className="relative flex flex-col items-start gap-5 sm:flex-row">
          <AdvisorAvatar advisor={advisor} className={style.avatar} />

          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-bold text-foreground sm:text-2xl [text-wrap:pretty]">
              {displayName}
            </h3>
            {advisor.designation || advisor.department ? (
              <p className="mt-1 text-sm text-muted-foreground [text-wrap:pretty]">
                {[advisor.designation, advisor.department].filter(Boolean).join(" - ")}
              </p>
            ) : null}
            {advisor.advisorJnuitsId ? (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {advisor.advisorJnuitsId}
              </p>
            ) : null}

            {safeBio ? (
              <blockquote
                className={cn(
                  "mt-4 border-l-[3px] pl-4 text-sm italic leading-relaxed text-foreground/80",
                  style.blockquote
                )}
              >
                {safeBio}
              </blockquote>
            ) : null}

            {safeNote ? (
              <p className="mt-4 rounded-lg bg-muted/50 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
                {safeNote}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border/50 pt-4">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays aria-hidden="true" size={13} />
          {tenure}
        </span>
        {advisor.jnuProfileUrl ? (
          <a
            aria-label={`View JnU profile for ${displayName} (opens in new tab)`}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              style.link
            )}
            href={advisor.jnuProfileUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" size={13} />
            <span>JnU Profile</span>
            <span className="sr-only">(opens in new tab)</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}

function AdvisorAvatar({
  advisor,
  className,
}: {
  advisor: PublicAdvisorProfile;
  className: string;
}) {
  const displayName = formatAdvisorDisplayName(advisor);

  return (
    <div className="relative flex-shrink-0">
      {advisor.avatarUrl ? (
        // Public profile avatars are already optimized by the CMS/upload flow.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={displayName}
          className={cn("object-cover", className)}
          src={advisor.avatarUrl}
        />
      ) : (
        <div
          aria-hidden="true"
          className={cn(
            "flex items-center justify-center font-black",
            className
          )}
        >
          {getInitials(displayName)}
        </div>
      )}
    </div>
  );
}

import Image from "next/image";
import { CalendarDays, ExternalLink } from "lucide-react";

import type { PublicAdvisorProfile } from "@/lib/committee/public-contracts";
import {
  formatAdvisorDisplayName,
  formatAdvisorTenure,
  formatCommitteeDateRange,
  getInitials,
  isInternalNote,
} from "@/lib/committee-utils";

const JNUITS_FOUNDED_ON = "2015-11-11";

function cn(...classes: Array<false | null | string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function FormerAdvisorTimelineRow({
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
  const tenure = formatTimelineTenure(advisor);
  const typeMeta = getAdvisorTypeMeta(advisor.advisorType);

  return (
    <article className="group relative flex gap-5 py-6">
      <AdvisorTimelineAvatar advisor={advisor} displayName={displayName} />

      <div className="min-w-0 flex-1 pb-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold text-foreground">
            {displayName}
          </h4>
          {advisor.formerTitle ? (
            <span className="rounded-full border border-border/70 bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {advisor.formerTitle}
            </span>
          ) : null}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              typeMeta.className
            )}
          >
            {typeMeta.label}
          </span>
        </div>

        {advisor.designation ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {advisor.designation}
          </p>
        ) : null}

        {safeBio ? (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-foreground/70">
            {safeBio}
          </p>
        ) : null}

        {safeNote ? (
          <p className="mt-2 text-xs italic text-muted-foreground/80">
            {safeNote}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span
            className="inline-flex items-center gap-1"
            title={
              tenure.corrected
                ? "Advisory tenure starts from JnUITS founding date"
                : undefined
            }
          >
            <CalendarDays aria-hidden="true" size={11} />
            {tenure.label}
          </span>
          {advisor.jnuProfileUrl ? (
            <a
              aria-label={`JnU profile for ${displayName} (opens in new tab)`}
              className="inline-flex min-h-11 items-center gap-1 text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              href={advisor.jnuProfileUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" size={10} />
              JnU Profile
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function getAdvisorTypeMeta(advisorType: PublicAdvisorProfile["advisorType"]) {
  if (advisorType === "main_advisor") {
    return {
      className:
        "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
      label: "Chief Advisor",
    };
  }

  if (advisorType === "honorable_advisor") {
    return {
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
      label: "Honorable Advisor",
    };
  }

  return {
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    label: "Moderator/Mentor",
  };
}

function AdvisorTimelineAvatar({
  advisor,
  displayName,
}: {
  advisor: PublicAdvisorProfile;
  displayName: string;
}) {
  return (
    <div className="relative z-10 mt-0.5 flex size-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-card transition-colors group-hover:border-primary/40">
      {advisor.avatarUrl ? (
        <Image
          alt={displayName}
          className="rounded-full object-cover"
          fill
          sizes="40px"
          src={advisor.avatarUrl}
        />
      ) : (
        <span className="text-xs font-black text-muted-foreground">
          {getInitials(displayName)}
        </span>
      )}
    </div>
  );
}

function formatTimelineTenure(advisor: PublicAdvisorProfile) {
  const displayStart = getDisplayTenureStart(advisor);

  if (displayStart.corrected) {
    const correctedTenure = formatCommitteeDateRange(
      displayStart.value,
      advisor.leftOn,
      { variant: "short" }
    );

    return {
      corrected: true,
      label:
        advisor.dateConfidence !== "verified"
          ? `~ ${correctedTenure} · Estimated`
          : correctedTenure,
    };
  }

  const tenure = formatAdvisorTenure(advisor).replace(/^~\s*/, "");

  return {
    corrected: false,
    label:
      advisor.dateConfidence !== "verified"
        ? `~ ${tenure} · Estimated`
        : tenure,
  };
}

function getDisplayTenureStart(advisor: PublicAdvisorProfile) {
  const rawStart = advisor.joinedOn;

  if (!rawStart) {
    return { corrected: false, value: null };
  }

  if (rawStart < JNUITS_FOUNDED_ON) {
    return { corrected: true, value: JNUITS_FOUNDED_ON };
  }

  return { corrected: false, value: rawStart };
}

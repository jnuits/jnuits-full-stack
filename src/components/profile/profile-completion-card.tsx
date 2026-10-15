import Link from "next/link";
import { useId } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  Sparkles,
} from "lucide-react";

import type { ProfileCompletion, CompletionNextStep } from "@/lib/profile/completion";
export type { CompletionField, ProfileCompletion, CompletionNextStep } from "@/lib/profile/completion";

export type ProfileCompletionCardProps = {
  summary: ProfileCompletion;
  nextSteps?: readonly CompletionNextStep[];
  title?: string;
  className?: string;
};

function resolveStepHref(step: CompletionNextStep): string {
  if (!step.focusId) return step.href;
  if (step.href.includes("#")) return step.href;
  return `${step.href}#${encodeURIComponent(step.focusId)}`;
}

function renderStateBadge(state: CompletionNextStep["state"]) {
  switch (state) {
    case "pending_review":
      return (
        <span className="detail-chip flex items-center gap-1 text-[var(--warning-foreground,#b45309)]">
          <Clock size={11} aria-hidden="true" />
          <span>Under review</span>
        </span>
      );
    case "needs_verification":
      return (
        <span className="detail-chip flex items-center gap-1 text-[var(--accent-foreground,#4338ca)]">
          <AlertCircle size={11} aria-hidden="true" />
          <span>Verification needed</span>
        </span>
      );
    case "unavailable":
      return (
        <span className="detail-chip flex items-center gap-1 text-[var(--muted-foreground)]">
          <HelpCircle size={11} aria-hidden="true" />
          <span>Unavailable</span>
        </span>
      );
    case "missing":
    default:
      return null;
  }
}

export function ProfileCompletionCard({
  summary,
  nextSteps = [],
  title = "Profile completeness",
  className = "",
}: ProfileCompletionCardProps) {
  const headingId = useId();
  const isUnavailable = summary.status === "unavailable" || summary.percent === null;
  const isComplete = !isUnavailable && summary.percent === 100;
  const displayedSteps = (nextSteps || []).slice(0, 3);

  return (
    <section
      aria-labelledby={headingId}
      className={`rounded-[0.9rem] border border-[var(--line)] bg-[var(--card)] p-4 sm:p-5 shadow-sm ${className}`}
      data-testid="profile-completion-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_80%,var(--card))]"
            aria-hidden="true"
          >
            {isComplete ? (
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
            ) : isUnavailable ? (
              <AlertCircle size={16} className="text-[var(--muted-foreground)]" />
            ) : (
              <Sparkles size={16} className="text-[var(--primary,#0284c7)]" />
            )}
          </div>
          <div>
            <h2
              id={headingId}
              className="font-[family-name:var(--font-heading)] text-base font-semibold text-[var(--foreground)]"
            >
              {title}
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              {isUnavailable
                ? "Completion status is temporarily unavailable"
                : isComplete
                  ? "Applicable details complete"
                  : `${summary.completed} of ${summary.applicable} core checks complete`}
            </p>
          </div>
        </div>

        {!isUnavailable && (
          <div className="text-right">
            <span
              className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl"
              data-testid="profile-completion-percent"
            >
              {summary.percent}%
            </span>
          </div>
        )}
      </div>

      {!isUnavailable && (
        <div className="mt-4">
          <div
            role="progressbar"
            aria-valuenow={summary.percent ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${summary.percent}% complete, ${summary.completed} of ${summary.applicable} checks passed`}
            aria-label="Profile completeness progress"
            className="h-2 w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--line)_70%,var(--background))]"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isComplete
                  ? "bg-emerald-600 dark:bg-emerald-500"
                  : (summary.percent ?? 0) >= 70
                    ? "bg-[var(--primary,#0284c7)]"
                    : "bg-amber-500 dark:bg-amber-400"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, summary.percent ?? 0))}%` }}
            />
          </div>
        </div>
      )}

      {isUnavailable ? (
        <div className="mt-4 rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_85%,var(--card))] p-3.5 text-xs text-[var(--muted-foreground)]">
          <p>
            Profile completion criteria could not be evaluated at this time. Routine profile
            editing and portal operations remain unaffected.
          </p>
        </div>
      ) : isComplete ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200/50 bg-emerald-50/50 p-3 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
          <CheckCircle2 size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>All core identity and profile checks pass the current rubric. Social links remain optional.</span>
        </div>
      ) : displayedSteps.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-semibold tracking-wider text-[var(--muted-foreground)] uppercase">
            Suggested next steps (up to 3)
          </p>
          <ul className="grid gap-2" role="list" aria-label="Profile completion steps">
            {displayedSteps.map((step, index) => {
              const stepHref = resolveStepHref(step);
              const isPending = step.state === "pending_review";

              return (
                <li
                  key={`${step.field}-${index}`}
                  className="group flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_70%,var(--card))] p-2.5 text-xs transition-colors hover:border-[var(--primary,#0284c7)] hover:bg-[var(--card)]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--line)] font-mono text-[10px] text-[var(--foreground)]"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    <span className="font-medium text-[var(--foreground)] truncate">
                      {step.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {renderStateBadge(step.state)}
                    <Link
                      href={stepHref}
                      className="inline-flex items-center gap-1 font-semibold text-[var(--primary,#0284c7)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary,#0284c7)] focus-visible:ring-offset-1"
                    >
                      <span>{isPending ? "View status" : "Update"}</span>
                      <ArrowUpRight size={12} aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Compass } from "lucide-react";

export type AdminRecommendation = {
  id: string;
  label: string;
  explanation: string;
  href: string;
};

export type AdminRecommendationsCardProps = {
  recommendations: readonly AdminRecommendation[];
  title?: string;
  className?: string;
};

export function AdminRecommendationsCard({
  recommendations,
  title = "Suggested administrative actions",
  className = "",
}: AdminRecommendationsCardProps) {
  const displayed = (recommendations || []).slice(0, 3);

  if (displayed.length === 0) {
    return (
      <div
        className={`rounded-[0.9rem] border border-[var(--line)] bg-[var(--card)] p-4 text-xs shadow-sm ${className}`}
        data-testid="admin-recommendations-card-empty"
      >
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span className="font-semibold">All recommendations complete</span>
        </div>
        <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
          Your profile, security settings, and assigned duty queues have no pending action items.
        </p>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="recommendations-heading"
      className={`rounded-[0.9rem] border border-[var(--line)] bg-[var(--card)] p-4 sm:p-5 shadow-sm ${className}`}
      data-testid="admin-recommendations-card"
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_80%,var(--card))]"
          aria-hidden="true"
        >
          <Compass size={16} className="text-[var(--primary,#0284c7)]" />
        </div>
        <div>
          <h2
            id="recommendations-heading"
            className="font-[family-name:var(--font-heading)] text-base font-semibold text-[var(--foreground)]"
          >
            {title}
          </h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Personal priority suggestions for your admin identity and permitted queues (up to 3).
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2.5" role="list" aria-label="Administrative recommendations">
        {displayed.map((item, idx) => (
          <article
            key={item.id}
            role="listitem"
            className="group flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_70%,var(--card))] p-3 text-xs transition-colors hover:border-[var(--primary,#0284c7)] hover:bg-[var(--card)]"
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--line)] font-mono text-[10px] text-[var(--foreground)]"
                aria-hidden="true"
              >
                {idx + 1}
              </span>
              <div className="space-y-0.5 min-w-0">
                <p className="font-medium text-[var(--foreground)]">{item.label}</p>
                <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                  {item.explanation}
                </p>
              </div>
            </div>

            <Link
              href={item.href}
              className="inline-flex items-center gap-1 font-semibold text-[var(--primary,#0284c7)] hover:underline text-xs shrink-0"
            >
              <span>Take action</span>
              <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

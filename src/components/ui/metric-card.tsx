/**
 * MetricCard — Reusable metric display card.
 * Shows a label, large numeric value, and optional description.
 */

interface MetricCardProps {
  label: string;
  value: number | string;
  description?: string;
  id?: string;
  tone?: "default" | "success" | "warning" | "danger";
}

const toneClass: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "",
  success: "metric-card--success",
  warning: "metric-card--warning",
  danger: "metric-card--danger",
};

export function MetricCard({ label, value, description, id, tone = "default" }: MetricCardProps) {
  return (
    <article className={`metric-card ${toneClass[tone]}`} id={id}>
      <p className="metric-card__label">
        {label}
      </p>
      <p className="metric-card__value mt-3">{value}</p>
      {description ? (
        <p className="mt-3 text-sm leading-7" style={{ color: "var(--muted-foreground)" }}>{description}</p>
      ) : null}
    </article>
  );
}

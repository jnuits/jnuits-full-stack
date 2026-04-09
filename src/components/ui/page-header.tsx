/**
 * PageHeader — Reusable page/section header.
 * Renders an eyebrow label, title, optional description, and optional badge.
 */

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: string;
  /** Size variant — defaults to 'page' for h1, 'section' for h2 */
  as?: "h1" | "h2";
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  badge,
  as: Tag = "h1",
  className = "",
}: PageHeaderProps) {
  return (
    <div className={`page-header ${className}`}>
      {(eyebrow || badge) ? (
        <div className="workspace-topbar">
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          {badge ? <span className="status-pill">{badge}</span> : null}
        </div>
      ) : null}
      <Tag
        className={
          Tag === "h1"
            ? "section-title text-[2.5rem]"
            : "mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.4rem)] leading-[0.96] tracking-[-0.04em]"
        }
      >
        {title}
      </Tag>
      {description ? (
        <p className="section-copy mt-3">{description}</p>
      ) : null}
    </div>
  );
}

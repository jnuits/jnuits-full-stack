/**
 * EmptyState — Reusable empty state component.
 * Displays an icon, title, description, and optional CTA buttons.
 * Replaces bare "No records matched" text throughout the app.
 */
import Link from "next/link";

interface EmptyStateAction {
  label: string;
  href: string;
  variant?: "primary" | "secondary" | "ghost";
}

interface EmptyStateProps {
  /** SVG icon content (path data). Defaults to inbox icon. */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
  className?: string;
}

const defaultIcon = (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect x="4" y="10" width="40" height="28" rx="4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
    <path d="M4 22h10l4 6h12l4-6h10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

export function EmptyState({ icon = defaultIcon, title, description, actions = [], className = "" }: EmptyStateProps) {
  return (
    <div className={`empty-state-block ${className}`} role="status" aria-live="polite">
      <div className="empty-state-block__icon" aria-hidden="true">
        {icon}
      </div>
      <h3 className="empty-state-block__title">{title}</h3>
      {description ? (
        <p className="empty-state-block__desc">{description}</p>
      ) : null}
      {actions.length > 0 ? (
        <div className="empty-state-block__actions">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={
                action.variant === "primary"
                  ? "primary-button"
                  : action.variant === "ghost"
                    ? "ghost-button"
                    : "secondary-button"
              }
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

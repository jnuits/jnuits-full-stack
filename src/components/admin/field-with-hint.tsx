import type { ReactNode } from "react";

type FieldWithHintProps = {
  children: (hintId: string) => ReactNode;
  className?: string;
  controlId: string;
  hint: ReactNode;
  label: ReactNode;
};

/**
 * Admin field shell that keeps guidance in the accessible description.
 * Wrapping hints inside a label makes the whole hint part of the control name.
 */
export function FieldWithHint({
  children,
  className = "",
  controlId,
  hint,
  label,
}: FieldWithHintProps) {
  const hintId = `${controlId}-hint`;

  return (
    <div className={`input-label ${className}`.trim()}>
      <label htmlFor={controlId}>{label}</label>
      {children(hintId)}
      <span
        className="mt-1 block text-xs font-normal text-[var(--muted-foreground)]"
        id={hintId}
      >
        {hint}
      </span>
    </div>
  );
}

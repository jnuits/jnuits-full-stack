"use client";
/**
 * FormField — Accessible form field wrapper.
 * Renders a label + input/select/textarea with optional hint and error.
 * Eliminates the aria-accessibility gap of placeholder-only fields.
 */
import { type ReactNode, useId } from "react";

interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (id: string, describedBy: string | undefined) => ReactNode;
  className?: string;
}

export function FormField({ label, hint, error, required, children, className = "" }: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`form-field ${error ? "form-field--error" : ""} ${className}`}>
      <label htmlFor={id} className="input-label">
        {label}
        {required ? (
          <span className="form-field__required" aria-hidden="true"> *</span>
        ) : null}
      </label>
      {children(id, describedBy)}
      {hint && !error ? (
        <p id={hintId} className="form-field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

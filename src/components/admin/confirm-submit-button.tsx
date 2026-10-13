"use client";

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ConfirmSubmitButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  cancelLabel?: string;
  children: ReactNode;
  confirmLabel?: string;
  description: string;
  title: string;
};

export function ConfirmSubmitButton({
  cancelLabel = "Cancel",
  children,
  confirmLabel = "Confirm",
  description,
  disabled,
  onClick,
  title,
  ...buttonProps
}: ConfirmSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const allowSubmitRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      const first = controls?.[0]; const last = controls?.[controls.length - 1];
      if (!first || !last) return;
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        {...buttonProps}
        disabled={disabled}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented || disabled) return;
          if (allowSubmitRef.current) {
            allowSubmitRef.current = false;
            return;
          }
          event.preventDefault();
          setOpen(true);
        }}
        ref={buttonRef}
        type="submit"
      >
        {children}
      </button>

      {/* Viewport confirmations must escape the caller's fieldset and scroll layout. */}
      {open ? createPortal(
        <div aria-modal="true" className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-4" ref={dialogRef} role="dialog">
          <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--background)] p-5 shadow-2xl">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{description}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button className="admin-btn admin-btn--ghost" onClick={() => { setOpen(false); buttonRef.current?.focus(); }} type="button">
                {cancelLabel}
              </button>
              <button
                className="admin-btn admin-btn--danger"
                onClick={() => {
                  const original = buttonRef.current;
                  if (!original || original.matches(":disabled")) return;
                  setOpen(false);
                  original.focus();
                  allowSubmitRef.current = true;
                  try { original.click(); }
                  finally { allowSubmitRef.current = false; }
                }}
                type="button"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}
"use client";

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

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

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
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

      {open ? (
        <div aria-modal="true" className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-4" role="dialog">
          <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--background)] p-5 shadow-2xl">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{description}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button className="admin-btn admin-btn--ghost" onClick={() => setOpen(false)} type="button">
                {cancelLabel}
              </button>
              <button
                className="admin-btn admin-btn--danger"
                onClick={() => {
                  setOpen(false);
                  allowSubmitRef.current = true;
                  buttonRef.current?.click();
                }}
                type="button"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type IndicatorState = "idle" | "saved" | "unsaved";

type NoticeEditorSaveIndicatorProps = {
  initialSaved?: boolean;
};

export function NoticeEditorSaveIndicator({
  initialSaved = false,
}: NoticeEditorSaveIndicatorProps) {
  const { pending } = useFormStatus();
  const [state, setState] = useState<IndicatorState>(
    initialSaved ? "saved" : "idle"
  );
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!initialSaved) {
      return;
    }

    hideTimerRef.current = window.setTimeout(() => setState("idle"), 3000);

    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, [initialSaved]);

  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>(".notice-editor");

    if (!form) {
      return;
    }

    function clearTimers() {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
    }

    function handleChange() {
      clearTimers();
      dirtyRef.current = true;
      setState("unsaved");
    }

    function handleSubmit() {
      clearTimers();
      dirtyRef.current = false;
      setPendingHref(null);
      setState("idle");
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = "You have unsaved changes. Leave anyway?";
    }

    function handleDocumentClick(event: MouseEvent) {
      if (!dirtyRef.current || event.defaultPrevented) {
        return;
      }

      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target as Element | null;
      const link = target?.closest<HTMLAnchorElement>("a[href]");

      if (!link || link.target === "_blank") {
        return;
      }

      const href = link.href;
      const nextUrl = new URL(href, window.location.href);
      const currentUrl = new URL(window.location.href);

      if (
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search &&
        nextUrl.hash
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingHref(href);
    }

    form.addEventListener("change", handleChange, true);
    form.addEventListener("input", handleChange, true);
    form.addEventListener("submit", handleSubmit, true);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      clearTimers();
      form.removeEventListener("change", handleChange, true);
      form.removeEventListener("input", handleChange, true);
      form.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, []);

  const resolvedState = pending ? "saving" : state;
  const visible = resolvedState !== "idle";
  const label =
    resolvedState === "saving"
      ? "Saving..."
      : resolvedState === "saved"
        ? "Saved"
        : "Unsaved changes";
  const marker = resolvedState === "saved" ? "✓" : "●";

  return (
    <>
      <span
        aria-live="polite"
        className={`notice-editor-save-indicator${
          visible ? " notice-editor-save-indicator--visible" : ""
        } notice-editor-save-indicator--${resolvedState}`}
      >
        <span aria-hidden="true">{marker}</span>
        {label}
      </span>

      {pendingHref ? (
        <div aria-modal="true" className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-4" role="dialog">
          <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--background)] p-5 shadow-2xl">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold">Leave with unsaved changes?</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
              Your notice edits have not been saved. Leaving this page will discard the current changes.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button className="admin-btn admin-btn--ghost" onClick={() => setPendingHref(null)} type="button">
                Stay here
              </button>
              <button
                className="admin-btn admin-btn--danger"
                onClick={() => {
                  dirtyRef.current = false;
                  window.location.href = pendingHref;
                }}
                type="button"
              >
                Leave page
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
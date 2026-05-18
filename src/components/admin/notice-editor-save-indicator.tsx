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
      if (!dirtyRef.current) {
        return;
      }

      const target = event.target as Element | null;
      const link = target?.closest<HTMLAnchorElement>("a[href]");

      if (!link || link.target === "_blank" || link.href.startsWith("#")) {
        return;
      }

      const confirmed = window.confirm(
        "You have unsaved changes. Leave anyway?"
      );

      if (!confirmed) {
        event.preventDefault();
        event.stopPropagation();
      }
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
    <span
      aria-live="polite"
      className={`notice-editor-save-indicator${
        visible ? " notice-editor-save-indicator--visible" : ""
      } notice-editor-save-indicator--${resolvedState}`}
    >
      <span aria-hidden="true">{marker}</span>
      {label}
    </span>
  );
}

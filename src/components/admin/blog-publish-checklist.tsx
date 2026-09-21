"use client";

import { useEffect, useRef, useState } from "react";

type ChecklistItem = {
  key: "body" | "publishedAt" | "summary" | "title";
  label: string;
};

const CHECKLIST_ITEMS = [
  { key: "title", label: "Title or generated slug" },
  { key: "summary", label: "Summary" },
  { key: "body", label: "Markdown body" },
  { key: "publishedAt", label: "Publish date" },
] satisfies ChecklistItem[];

type BlogPublishChecklistProps = {
  defaults: Record<ChecklistItem["key"], string>;
};

type PublishDialog =
  | { kind: "blocked"; missing: ChecklistItem[] }
  | { kind: "confirm" }
  | null;

function getValue(form: HTMLFormElement | null, name: string) {
  if (!form) {
    return "";
  }

  const field = form.elements.namedItem(name);

  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    return field.value.trim();
  }

  return "";
}

function readChecklistState(form: HTMLFormElement | null) {
  return {
    body: getValue(form, "body"),
    publishedAt: getValue(form, "publishedAt"),
    summary: getValue(form, "summary"),
    title: getValue(form, "title"),
  };
}

export function BlogPublishChecklist({ defaults }: BlogPublishChecklistProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const publishButtonRef = useRef<HTMLButtonElement | null>(null);
  const allowPublishRef = useRef(false);
  const [state, setState] = useState(defaults);
  const [dialog, setDialog] = useState<PublishDialog>(null);

  useEffect(() => {
    const form = rootRef.current?.closest("form") || null;

    function updateState() {
      setState(readChecklistState(form));
    }

    function onSubmit(event: SubmitEvent) {
      const submitter = event.submitter;

      if (!(submitter instanceof HTMLButtonElement)) {
        return;
      }

      if (submitter.name !== "intent" || submitter.value !== "publish") {
        return;
      }

      if (allowPublishRef.current) {
        allowPublishRef.current = false;
        return;
      }

      event.preventDefault();
      publishButtonRef.current = submitter;

      const nextState = readChecklistState(form);
      setState(nextState);
      const missing = CHECKLIST_ITEMS.filter((item) => !nextState[item.key]);

      if (missing.length > 0) {
        setDialog({ kind: "blocked", missing });
        return;
      }

      setDialog({ kind: "confirm" });
    }

    updateState();
    form?.addEventListener("input", updateState);
    form?.addEventListener("change", updateState);
    form?.addEventListener("submit", onSubmit);

    return () => {
      form?.removeEventListener("input", updateState);
      form?.removeEventListener("change", updateState);
      form?.removeEventListener("submit", onSubmit);
    };
  }, [defaults]);

  useEffect(() => {
    if (!dialog) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDialog(null);
        publishButtonRef.current?.focus();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dialog]);

  function confirmPublish() {
    const button = publishButtonRef.current;
    setDialog(null);
    if (!button) return;
    allowPublishRef.current = true;
    button.click();
  }

  return (
    <div ref={rootRef}>
      <ul className="blog-validation-list">
        {CHECKLIST_ITEMS.map((item) => (
          <li data-state={state[item.key] ? "done" : "pending"} key={item.key}>
            {item.label}
          </li>
        ))}
      </ul>
      <p className="blog-validation-note">
        Publish checks update as you type. Save draft keeps the post out of the
        public blog listing.
      </p>

      {dialog ? (
        <div aria-modal="true" className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-4" role="dialog">
          <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--background)] p-5 shadow-2xl">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold">
              {dialog.kind === "blocked" ? "Complete required fields" : "Publish blog post?"}
            </h2>
            {dialog.kind === "blocked" ? (
              <>
                <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                  This post cannot be published until the required fields are complete.
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--muted-foreground)]">
                  {dialog.missing.map((item) => (
                    <li key={item.key}>{item.label}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                This will make the blog post visible on the public site using the current content and publish date.
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button className="admin-btn admin-btn--ghost" onClick={() => setDialog(null)} type="button">
                {dialog.kind === "blocked" ? "Close" : "Cancel"}
              </button>
              {dialog.kind === "confirm" ? (
                <button className="admin-btn admin-btn--primary" onClick={confirmPublish} type="button">
                  Publish
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
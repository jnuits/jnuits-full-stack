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
  const [state, setState] = useState(defaults);

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

      const nextState = readChecklistState(form);
      setState(nextState);
      const missing = CHECKLIST_ITEMS.filter((item) => !nextState[item.key]);

      if (missing.length > 0) {
        event.preventDefault();
        window.alert(
          `Complete before publishing: ${missing
            .map((item) => item.label)
            .join(", ")}.`
        );
        return;
      }

      if (!window.confirm("Publish this blog post to the public site now?")) {
        event.preventDefault();
      }
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
    </div>
  );
}

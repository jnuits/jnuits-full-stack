"use client";

import { useState } from "react";
import { EventMarkdown } from "@/components/events/event-markdown";

type EventMarkdownEditorProps = {
  defaultValue: string;
  name: string;
  placeholder?: string;
};

export function EventMarkdownEditor({
  defaultValue,
  name,
  placeholder,
}: EventMarkdownEditorProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="event-markdown-editor">
      <label className="input-label">
        Event body (Markdown)
        <textarea
          name={name}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          rows={18}
          value={value}
        />
      </label>
      <div className="admin-review-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="admin-section-label">Preview</p>
            <h2 className="admin-card-row__title">Rendered event body</h2>
          </div>
          <span className="status-pill">Markdown</span>
        </div>
        <div className="event-markdown-editor__preview">
          <EventMarkdown
            source={
              value.trim() ||
              "No public body yet. Add Markdown content to describe this event."
            }
          />
        </div>
      </div>
    </div>
  );
}

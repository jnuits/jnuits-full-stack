"use client";

import { useRef, useState } from "react";
import {
  Bold,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  Quote,
} from "lucide-react";
import { NoticeMarkdown } from "@/components/notices/notice-markdown";

type NoticeMarkdownEditorProps = {
  defaultValue: string;
  name: string;
  placeholder?: string;
};

type MarkdownAction = "bold" | "heading" | "italic" | "link" | "list" | "quote";

function applyMarkdownAction(action: MarkdownAction) {
  switch (action) {
    case "bold":
      return { prefix: "**", suffix: "**", fallback: "important text" };
    case "heading":
      return { prefix: "## ", suffix: "", fallback: "Section heading" };
    case "italic":
      return { prefix: "_", suffix: "_", fallback: "emphasis" };
    case "link":
      return { prefix: "[", suffix: "](https://)", fallback: "link text" };
    case "list":
      return { prefix: "- ", suffix: "", fallback: "List item" };
    case "quote":
      return { prefix: "> ", suffix: "", fallback: "Quoted note" };
    default:
      return { prefix: "", suffix: "", fallback: "" };
  }
}

export function NoticeMarkdownEditor({
  defaultValue,
  name,
  placeholder,
}: NoticeMarkdownEditorProps) {
  const [value, setValue] = useState(defaultValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertMarkdown(action: MarkdownAction) {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const selectedText = value.slice(selectionStart, selectionEnd);
    const { fallback, prefix, suffix } = applyMarkdownAction(action);
    const replacement = `${prefix}${selectedText || fallback}${suffix}`;
    const nextValue =
      value.slice(0, selectionStart) + replacement + value.slice(selectionEnd);
    const nextCursor = selectionStart + replacement.length;

    setValue(nextValue);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  return (
    <div className="notice-markdown-editor">
      <div className="notice-markdown-toolbar" aria-label="Markdown tools">
        <button
          aria-label="Heading"
          onClick={() => insertMarkdown("heading")}
          type="button"
        >
          <Heading2 aria-hidden="true" size={16} />
        </button>
        <button
          aria-label="Bold"
          onClick={() => insertMarkdown("bold")}
          type="button"
        >
          <Bold aria-hidden="true" size={16} />
        </button>
        <button
          aria-label="Italic"
          onClick={() => insertMarkdown("italic")}
          type="button"
        >
          <Italic aria-hidden="true" size={16} />
        </button>
        <button
          aria-label="Bulleted list"
          onClick={() => insertMarkdown("list")}
          type="button"
        >
          <List aria-hidden="true" size={16} />
        </button>
        <button
          aria-label="Quote"
          onClick={() => insertMarkdown("quote")}
          type="button"
        >
          <Quote aria-hidden="true" size={16} />
        </button>
        <button
          aria-label="Link"
          onClick={() => insertMarkdown("link")}
          type="button"
        >
          <LinkIcon aria-hidden="true" size={16} />
        </button>
        <span>Markdown with live preview</span>
      </div>
      <div className="notice-markdown-editor__grid">
        <label className="notice-markdown-editor__input">
          <span className="sr-only">Notice body markdown</span>
          <textarea
            name={name}
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
            ref={textareaRef}
            rows={18}
            value={value}
          />
        </label>
        <div className="notice-markdown-editor__preview">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="admin-section-label">Preview</p>
              <h3 className="admin-card-row__title">Rendered notice body</h3>
            </div>
            <span className="status-pill">Markdown</span>
          </div>
          <div className="notice-markdown-preview-surface">
            <NoticeMarkdown
              source={
                value.trim() ||
                "No public notice body yet. Add Markdown content for the detail page."
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

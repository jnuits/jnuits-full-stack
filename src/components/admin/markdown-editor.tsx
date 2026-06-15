"use client";

import { useRef, useState } from "react";
import {
  Bold,
  Code,
  EyeOff,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { BlogMarkdown } from "@/components/blogs/blog-markdown";

type MarkdownEditorProps = {
  defaultValue: string;
  guidance?: string;
  inputLabel?: string;
  name: string;
  placeholder?: string;
  previewLabel?: string;
  previewTitle?: string;
  required?: boolean;
  rows?: number;
};

type MarkdownAction =
  | "bold"
  | "code"
  | "heading"
  | "image"
  | "italic"
  | "link"
  | "list"
  | "orderedList"
  | "quote";

function applyMarkdownAction(action: MarkdownAction) {
  switch (action) {
    case "bold":
      return { prefix: "**", suffix: "**", fallback: "important text" };
    case "code":
      return { prefix: "`", suffix: "`", fallback: "inline code" };
    case "heading":
      return { prefix: "## ", suffix: "", fallback: "Section heading" };
    case "image":
      return { prefix: "![", suffix: "](image-url)", fallback: "Alt text" };
    case "italic":
      return { prefix: "_", suffix: "_", fallback: "emphasis" };
    case "link":
      return { prefix: "[", suffix: "](https://)", fallback: "link text" };
    case "list":
      return { prefix: "- ", suffix: "", fallback: "List item" };
    case "orderedList":
      return { prefix: "1. ", suffix: "", fallback: "List item" };
    case "quote":
      return { prefix: "> ", suffix: "", fallback: "Quoted note" };
    default:
      return { prefix: "", suffix: "", fallback: "" };
  }
}

export function MarkdownEditor({
  defaultValue,
  guidance = "Markdown with live preview",
  inputLabel = "Blog body markdown",
  name,
  placeholder,
  previewLabel = "Preview",
  previewTitle = "Rendered blog body",
  required = false,
  rows = 18,
}: MarkdownEditorProps) {
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
    const selectedMediaUrl =
      action === "image"
        ? textarea.form?.querySelector<HTMLInputElement>(
            'input[name="selectedMediaSecureUrl"]'
          )?.value || ""
        : "";
    const selectedMediaAlt =
      action === "image"
        ? textarea.form?.querySelector<HTMLInputElement>(
            'input[name="selectedMediaAltText"]'
          )?.value || ""
        : "";
    const actionTemplate = applyMarkdownAction(action);
    const { prefix } = actionTemplate;
    const fallback =
      action === "image" && selectedMediaAlt
        ? selectedMediaAlt
        : actionTemplate.fallback;
    const suffix =
      action === "image" && selectedMediaUrl
        ? `](${selectedMediaUrl})`
        : actionTemplate.suffix;
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
    <div className="markdown-editor">
      <div className="markdown-editor__toolbar" aria-label="Markdown tools">
        <button
          aria-label="Heading"
          onClick={() => insertMarkdown("heading")}
          title="Heading 2"
          type="button"
        >
          <Heading2 aria-hidden="true" size={16} />
        </button>
        <button
          aria-label="Bold"
          onClick={() => insertMarkdown("bold")}
          title="Bold"
          type="button"
        >
          <Bold aria-hidden="true" size={16} />
        </button>
        <button
          aria-label="Italic"
          onClick={() => insertMarkdown("italic")}
          title="Italic"
          type="button"
        >
          <Italic aria-hidden="true" size={16} />
        </button>
        <button
          aria-label="Bulleted list"
          onClick={() => insertMarkdown("list")}
          title="Bullet list"
          type="button"
        >
          <List aria-hidden="true" size={16} />
        </button>
        <button
          aria-label="Numbered list"
          onClick={() => insertMarkdown("orderedList")}
          title="Numbered list"
          type="button"
        >
          <ListOrdered aria-hidden="true" size={16} />
        </button>
        <button
          aria-label="Quote"
          onClick={() => insertMarkdown("quote")}
          title="Quote"
          type="button"
        >
          <Quote aria-hidden="true" size={16} />
        </button>
        <button
          aria-label="Inline code"
          onClick={() => insertMarkdown("code")}
          title="Inline code"
          type="button"
        >
          <Code aria-hidden="true" size={16} />
        </button>
        <button
          aria-label="Link"
          onClick={() => insertMarkdown("link")}
          title="Insert link"
          type="button"
        >
          <LinkIcon aria-hidden="true" size={16} />
        </button>
        <button
          aria-label="Image"
          onClick={() => insertMarkdown("image")}
          title="Insert image"
          type="button"
        >
          <ImageIcon aria-hidden="true" size={16} />
        </button>
        <span>{guidance}</span>
      </div>
      <div className="markdown-editor__grid">
        <label className="markdown-editor__input">
          <span className="sr-only">{inputLabel}</span>
          <textarea
            name={name}
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
            ref={textareaRef}
            required={required}
            rows={rows}
            value={value}
          />
        </label>
        <div className="markdown-editor__preview">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="admin-section-label">{previewLabel}</p>
              <h3 className="admin-card-row__title">{previewTitle}</h3>
            </div>
            <span className="status-pill">Markdown</span>
          </div>
          <div className="markdown-preview-surface">
            {value.trim() ? (
              <BlogMarkdown source={value} />
            ) : (
              <div className="markdown-empty-state">
                <EyeOff aria-hidden="true" size={28} />
                <p>Start writing to see preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Server-rendered by default: react-markdown needs no client runtime here,
// so article pages stop shipping the remark/unified toolchain to browsers.
// Admin editors may still import this inside client boundaries.
import { Children, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sanitizeEventHtml } from "@/lib/content/sanitize-event-html";
import type { EventRichTextFormat } from "@/lib/content/events-shared";

type EventMarkdownProps = {
  format?: EventRichTextFormat;
  markdown?: string | null;
  source?: string | null;
};

function getReadableLinkLabel(href: string | undefined, children: ReactNode) {
  const childText = Children.toArray(children).join("").trim();

  if (!href || !/^https?:\/\//i.test(href) || childText !== href) {
    return children;
  }

  try {
    const url = new URL(href);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "docs.google.com") {
      return "Open Google document";
    }

    if (hostname === "meet.google.com") {
      return "Open Google Meet";
    }

    return `Open ${hostname}`;
  } catch {
    return "Open link";
  }
}

export function EventMarkdown({
  format = "markdown",
  markdown,
  source,
}: EventMarkdownProps) {
  const content = (source ?? markdown ?? "").trim();
  const className =
    "event-markdown prose dark:prose-invert max-w-none prose-slate lg:prose-lg prose-headings:font-[family-name:var(--font-heading)] prose-headings:tracking-[-0.03em] prose-p:leading-8 prose-li:leading-8 prose-strong:text-[var(--color-text-primary)] prose-a:font-semibold prose-a:no-underline hover:prose-a:text-[var(--foreground)] hover:prose-a:underline prose-a:underline-offset-[0.18em] prose-img:max-w-full prose-img:rounded-xl prose-img:border prose-img:border-[var(--color-border-tertiary)] prose-code:before:content-none prose-code:after:content-none";

  if (format === "html") {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: sanitizeEventHtml(content) }}
      />
    );
  }

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href, ...props }) => (
            <a
              {...props}
              href={href}
              className="transition-colors"
              rel="noreferrer"
              target="_blank"
            >
              {getReadableLinkLabel(href, children)}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}


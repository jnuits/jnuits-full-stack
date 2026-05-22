"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { EventRichTextFormat } from "@/lib/content/events-shared";

type EventMarkdownProps = {
  format?: EventRichTextFormat;
  markdown?: string | null;
  source?: string | null;
};

function hasHtmlMarkup(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function EventMarkdown({
  format = "markdown",
  markdown,
  source,
}: EventMarkdownProps) {
  const content = (source ?? markdown ?? "").trim();
  const className =
    "event-markdown prose dark:prose-invert max-w-none prose-slate lg:prose-lg prose-headings:font-[family-name:var(--font-heading)] prose-headings:tracking-[-0.03em] prose-p:leading-8 prose-li:leading-8 prose-strong:text-[var(--color-text-primary)] prose-a:font-semibold prose-a:no-underline hover:prose-a:text-[var(--foreground)] hover:prose-a:underline prose-a:underline-offset-[0.18em] prose-img:max-w-full prose-img:rounded-xl prose-img:border prose-img:border-[var(--color-border-tertiary)] prose-code:before:content-none prose-code:after:content-none";

  if (format === "html" || (format !== "plain" && hasHtmlMarkup(content))) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => (
            <a
              {...props}
              className="transition-colors"
              rel="noreferrer"
              target="_blank"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

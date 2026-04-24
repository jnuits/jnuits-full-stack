"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type EventMarkdownProps = {
  markdown?: string;
  source?: string;
};

export function EventMarkdown({ markdown, source }: EventMarkdownProps) {
  const content = source ?? markdown ?? "";

  return (
    <div className="event-markdown prose prose-slate max-w-none lg:prose-lg dark:prose-invert prose-headings:font-[family-name:var(--font-heading)] prose-headings:tracking-[-0.03em] prose-p:leading-8 prose-li:leading-8 prose-a:font-semibold prose-a:no-underline hover:prose-a:text-[var(--foreground)] hover:prose-a:underline prose-a:underline-offset-[0.18em] prose-code:before:content-none prose-code:after:content-none">
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

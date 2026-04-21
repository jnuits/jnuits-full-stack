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
    <div className="event-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => (
            <a
              {...props}
              className="queue-link"
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

// Server-rendered by default: react-markdown needs no client runtime here,
// so article pages stop shipping the remark/unified toolchain to browsers.
// Admin editors may still import this inside client boundaries.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type BlogMarkdownProps = {
  markdown?: string;
  source?: string;
};

function isInternalHref(href?: string) {
  return Boolean(href?.startsWith("/") || href?.startsWith("#"));
}

export function BlogMarkdown({ markdown, source }: BlogMarkdownProps) {
  const content = source ?? markdown ?? "";

  return (
    <div className="blog-markdown blog-bengali-text prose prose-slate max-w-none dark:prose-invert prose-headings:font-[family-name:var(--font-heading)] prose-headings:tracking-[-0.02em] prose-p:leading-8 prose-li:leading-8 prose-a:font-semibold prose-a:no-underline hover:prose-a:text-[var(--foreground)] hover:prose-a:underline prose-a:underline-offset-[0.18em] prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, ...props }) => (
            <a
              {...props}
              className="transition-colors"
              href={href}
              rel={isInternalHref(href) ? undefined : "noreferrer"}
              target={isInternalHref(href) ? undefined : "_blank"}
            />
          ),
          h1: ({ ...props }) => (
            <h2 {...props} className="blog-markdown__heading blog-markdown__heading--from-h1" />
          ),
          h2: ({ ...props }) => (
            <h2 {...props} className="blog-markdown__heading blog-markdown__heading--h2" />
          ),
          h3: ({ ...props }) => (
            <h3 {...props} className="blog-markdown__heading blog-markdown__heading--h3" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

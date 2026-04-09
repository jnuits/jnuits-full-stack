import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  formatDisplayDate,
  getPublishedBlogByIdentifier,
} from "@/lib/content/public-content";

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  const article = await getPublishedBlogByIdentifier(identifier);

  if (!article) {
    notFound();
  }

  if (identifier !== article.slug) {
    redirect(`/blogs/${article.slug}`);
  }

  return (
    <div className="shell py-12">
      <article className="glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              <span>{article.category}</span>
              <span>{formatDisplayDate(article.publishedAt)}</span>
              <span>{article.readTime}</span>
            </div>
            <h1 className="section-title mt-4">{article.title}</h1>
            <p className="section-copy mt-5">{article.summary}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="secondary-button" href="/blogs">
                Back to blogs
              </Link>
              {article.ctaHref ? (
                <Link className="ghost-button" href={article.ctaHref} target="_blank">
                  Related link
                </Link>
              ) : null}
            </div>
          </div>

          <div className="relative min-h-[300px] overflow-hidden rounded-[1.6rem] border border-[var(--line)]">
            <Image
              alt={article.title}
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1024px) 40vw, 100vw"
              src={article.imageSrc}
            />
          </div>
        </div>
      </article>

      <section className="mt-8 section-band">
        <p className="section-divider">Article</p>
        <div className="mt-6 grid gap-4">
          {article.body ? (
            article.body
              .split(/\n{2,}/)
              .map((paragraph) => paragraph.trim())
              .filter(Boolean)
              .map((paragraph) => (
                <p key={paragraph} className="text-base leading-8 text-[var(--muted)]">
                  {paragraph}
                </p>
              ))
          ) : (
            <p className="text-base leading-8 text-[var(--muted)]">{article.excerpt}</p>
          )}
        </div>
      </section>
    </div>
  );
}

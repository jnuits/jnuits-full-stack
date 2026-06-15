import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BlogCopyLinkButton } from "@/components/blogs/blog-copy-link-button";
import { BlogImage } from "@/components/blogs/blog-image";
import { BlogMarkdown } from "@/components/blogs/blog-markdown";
import { brandProfile } from "@/lib/branding";
import {
  BLOG_FEATURE_TEASER_LENGTH,
  decodeBlogIdentifier,
  getBlogHref,
  makeBlogTeaser,
} from "@/lib/content/blogs";
import {
  formatDisplayDate,
  getPublishedBlogByIdentifier,
} from "@/lib/content/public-content";

type BlogDetailParams = {
  params: Promise<{ identifier: string }>;
};

function isInternalHref(href: string) {
  return href.startsWith("/") || href.startsWith("#");
}

export async function generateMetadata({
  params,
}: BlogDetailParams): Promise<Metadata> {
  const { identifier } = await params;
  const normalizedIdentifier = decodeBlogIdentifier(identifier);
  const article = await getPublishedBlogByIdentifier(normalizedIdentifier);

  if (!article) {
    return {
      title: "Blog not found",
    };
  }

  const description = makeBlogTeaser(
    {
      body: article.body,
      excerpt: article.excerpt,
      summary: article.summary,
    },
    155
  );
  const canonicalPath = getBlogHref(article.slug);

  return {
    alternates: {
      canonical: canonicalPath,
    },
    description,
    openGraph: {
      description,
      images: [
        {
          alt: article.title,
          url: article.imageSrc,
        },
      ],
      publishedTime: article.publishedAt,
      siteName: brandProfile.shortName,
      title: article.title,
      type: "article",
      url: canonicalPath,
    },
    title: article.title,
  };
}

export default async function BlogDetailPage({ params }: BlogDetailParams) {
  const { identifier } = await params;
  const normalizedIdentifier = decodeBlogIdentifier(identifier);
  const article = await getPublishedBlogByIdentifier(normalizedIdentifier);

  if (!article) {
    notFound();
  }

  if (normalizedIdentifier !== article.slug) {
    redirect(getBlogHref(article.slug));
  }

  const bodySource =
    article.body ||
    makeBlogTeaser(
      {
        excerpt: article.excerpt,
        summary: article.summary,
      },
      BLOG_FEATURE_TEASER_LENGTH
    );
  const ctaIsInternal = article.ctaHref ? isInternalHref(article.ctaHref) : false;

  return (
    <div className="shell blog-detail-shell py-12">
      <article className="blog-detail-hero">
        <div className="blog-detail-hero__copy">
          <div className="blog-detail-meta">
            <span>{article.category}</span>
            <span>{formatDisplayDate(article.publishedAt)}</span>
            <span>{article.readTime}</span>
            <span>{article.sourceLabel}</span>
          </div>
          <h1 className="blog-detail-title blog-bengali-text">{article.title}</h1>
          <p className="blog-detail-byline">By {article.authorLabel}</p>
          <p className="blog-detail-summary blog-bengali-text">{article.summary}</p>
          <div className="blog-article-actions">
            <Link className="secondary-button" href="/blogs">
              Back to blogs
            </Link>
            {article.ctaHref ? (
              <Link
                className="ghost-button"
                href={article.ctaHref}
                rel={ctaIsInternal ? undefined : "noreferrer"}
                target={ctaIsInternal ? undefined : "_blank"}
              >
                Related link
              </Link>
            ) : null}
            <BlogCopyLinkButton />
          </div>
        </div>

        <BlogImage
          alt={article.title}
          category={article.category}
          className="blog-detail-hero__image"
          fetchPriority="high"
          loading="eager"
          sizes="(min-width: 1024px) 42vw, 100vw"
          src={article.imageSrc}
        />
      </article>

      <section className="blog-detail-body section-band">
        <p className="section-divider">Article</p>
        <BlogMarkdown source={bodySource} />
      </section>
    </div>
  );
}

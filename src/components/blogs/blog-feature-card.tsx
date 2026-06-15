import Link from "next/link";
import { BlogImage } from "@/components/blogs/blog-image";
import {
  BLOG_FEATURE_TEASER_LENGTH,
  getBlogHref,
  makeBlogTeaser,
} from "@/lib/content/blogs";
import {
  type BlogPreview,
  formatDisplayDate,
} from "@/lib/content/public-content";

type BlogFeatureCardProps = {
  blog: BlogPreview;
};

export function BlogFeatureCard({ blog }: BlogFeatureCardProps) {
  const blogHref = getBlogHref(blog.slug);

  return (
    <article className="blog-feature-card">
      <BlogImage
        alt={blog.title}
        category={blog.category}
        className="blog-feature-card__image"
        fetchPriority="high"
        loading="eager"
        sizes="(min-width: 1024px) 44vw, 100vw"
        src={blog.imageSrc}
      />
      <div className="blog-feature-card__body">
        <p className="section-divider">Featured article</p>
        <h2 className="blog-feature-card__title blog-bengali-text">
          <Link href={blogHref} prefetch={false}>{blog.title}</Link>
        </h2>
        <p className="blog-feature-card__teaser">
          {makeBlogTeaser(blog, BLOG_FEATURE_TEASER_LENGTH)}
        </p>
        <div className="blog-feature-card__meta">
          <span>{blog.category}</span>
          <span>{formatDisplayDate(blog.publishedAt)}</span>
          <span>{blog.readTime}</span>
        </div>
        <Link className="secondary-button" href={blogHref} prefetch={false}>
          Open article
        </Link>
      </div>
    </article>
  );
}

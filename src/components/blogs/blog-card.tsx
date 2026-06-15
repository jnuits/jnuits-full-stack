import Link from "next/link";
import { BlogImage } from "@/components/blogs/blog-image";
import {
  BLOG_CARD_TEASER_LENGTH,
  getBlogHref,
  makeBlogTeaser,
} from "@/lib/content/blogs";
import {
  type BlogPreview,
  formatDisplayDate,
} from "@/lib/content/public-content";

type BlogCardProps = {
  blog: BlogPreview;
};

export function BlogCard({ blog }: BlogCardProps) {
  const blogHref = getBlogHref(blog.slug);

  return (
    <article className="blog-card">
      <BlogImage
        alt={blog.title}
        className="blog-card__image"
        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 44vw, 100vw"
        src={blog.imageSrc}
      />
      <div className="blog-card__body">
        <div className="blog-card__meta">
          <span>{blog.category}</span>
          <span>{formatDisplayDate(blog.publishedAt)}</span>
          <span>{blog.readTime}</span>
        </div>
        <h2 className="blog-card__title blog-bengali-text">
          <Link href={blogHref} prefetch={false}>{blog.title}</Link>
        </h2>
        <p className="blog-card__teaser">
          {makeBlogTeaser(blog, BLOG_CARD_TEASER_LENGTH)}
        </p>
        <Link className="queue-link" href={blogHref} prefetch={false}>
          Read article
        </Link>
      </div>
    </article>
  );
}

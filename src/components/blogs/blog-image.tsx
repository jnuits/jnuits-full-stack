import Image from "next/image";
import {
  getBlogFallbackVisual,
  isBlogFallbackImage,
} from "@/lib/content/blogs";

type BlogImageProps = {
  alt: string;
  category?: null | string;
  className?: string;
  fetchPriority?: "auto" | "high" | "low";
  imageClassName?: string;
  loading?: "eager" | "lazy";
  sizes: string;
  src?: null | string;
};

export function BlogImage({
  alt,
  category,
  className = "",
  fetchPriority = "auto",
  imageClassName = "",
  loading = "lazy",
  sizes,
  src,
}: BlogImageProps) {
  if (!src || isBlogFallbackImage(src)) {
    const fallback = getBlogFallbackVisual({ category, title: alt });

    return (
      <div
        className={`blog-image blog-image--placeholder ${className}`}
        data-tone={fallback.tone}
      >
        <div>
          <span>{fallback.categoryLabel}</span>
          <strong>{fallback.initials}</strong>
        </div>
      </div>
    );
  }

  return (
    <div className={`blog-image ${className}`}>
      <Image
        alt={alt}
        className={`object-cover ${imageClassName}`}
        fetchPriority={fetchPriority}
        fill
        loading={loading}
        sizes={sizes}
        src={src}
      />
    </div>
  );
}

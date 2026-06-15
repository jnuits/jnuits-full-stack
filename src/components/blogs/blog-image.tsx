import Image from "next/image";
import { isBlogFallbackImage } from "@/lib/content/blogs";

type BlogImageProps = {
  alt: string;
  className?: string;
  fetchPriority?: "auto" | "high" | "low";
  imageClassName?: string;
  loading?: "eager" | "lazy";
  sizes: string;
  src?: null | string;
};

export function BlogImage({
  alt,
  className = "",
  fetchPriority = "auto",
  imageClassName = "",
  loading = "lazy",
  sizes,
  src,
}: BlogImageProps) {
  if (!src || isBlogFallbackImage(src)) {
    return (
      <div className={`blog-image blog-image--placeholder ${className}`}>
        <div>
          <span>JnUITS</span>
          <strong>Editorial</strong>
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

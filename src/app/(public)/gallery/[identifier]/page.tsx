import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPublishedGalleryByIdentifier } from "@/lib/content/public-content";

export default async function GalleryDetailPage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  const media = await getPublishedGalleryByIdentifier(identifier);

  if (!media) {
    notFound();
  }

  if (identifier !== media.id) {
    redirect(`/gallery/${media.id}`);
  }

  return (
    <div className="shell py-12">
      <article className="glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div>
            <span className="eyebrow">Gallery media</span>
            <h1 className="section-title mt-4">{media.title}</h1>
            <p className="section-copy mt-5">{media.caption}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="secondary-button" href="/gallery">
                Back to gallery
              </Link>
              <Link className="ghost-button" href={media.secureUrl} target="_blank">
                Open original media
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.6rem] border border-[var(--line)]">
            {media.mediaKind === "video" ? (
              <video
                className="h-full min-h-[300px] w-full object-cover"
                controls
                poster={media.thumbnailUrl || undefined}
                preload="metadata"
              >
                <source src={media.secureUrl} />
              </video>
            ) : (
              <div className="relative min-h-[300px]">
                <Image
                  alt={media.title}
                  className="object-cover"
                  fill
                  priority
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  src={media.secureUrl}
                />
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}

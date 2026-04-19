import Image from "next/image";
import Link from "next/link";
import { getPublishedGallery } from "@/lib/content/public-content";

export default async function GalleryPage() {
  const publicGallery = await getPublishedGallery();
  const heroPrimary = publicGallery[0];
  const heroSecondary = publicGallery[1] || heroPrimary;
  const heroTertiary = publicGallery[2] || heroPrimary;

  return (
    <div className="shell py-12">
      <section className="glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[0.94fr_1.06fr] lg:items-center">
          <div>
            <span className="eyebrow">Media and atmosphere</span>
            <h1 className="section-title mt-4">
              Visual highlights from JnUITS programs, events, and community activities.
            </h1>
            <p className="section-copy mt-5">
              The gallery preserves society moments through photos and media
              records that can be viewed and shared through stable public links.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="relative min-h-[220px] overflow-hidden rounded-[1.5rem] border border-[var(--line)] sm:row-span-2">
              <Image
                alt={heroPrimary.title}
                className="object-cover"
                fill
                priority
                sizes="(min-width: 640px) 32vw, 100vw"
                src={heroPrimary.imageSrc}
              />
            </div>
            <div className="relative min-h-[150px] overflow-hidden rounded-[1.5rem] border border-[var(--line)]">
              <Image
                alt={heroSecondary.title}
                className="object-cover"
                fill
                sizes="(min-width: 640px) 24vw, 100vw"
                src={heroSecondary.imageSrc}
              />
            </div>
            <div className="relative min-h-[150px] overflow-hidden rounded-[1.5rem] border border-[var(--line)]">
              <Image
                alt={heroTertiary.title}
                className="object-cover"
                fill
                sizes="(min-width: 640px) 24vw, 100vw"
                src={heroTertiary.imageSrc}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 section-band">
        <p className="section-divider">Archive preview</p>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {publicGallery.map((item) => (
            <article key={item.title} className="grid gap-4">
              <div className="relative min-h-[240px] overflow-hidden rounded-[1.5rem] border border-[var(--line)]">
                <Image
                  alt={item.title}
                  className="object-cover"
                  fill
                  sizes="(min-width: 1024px) 30vw, 100vw"
                  src={item.imageSrc}
                />
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-heading)] text-[1.7rem] leading-[1.02] tracking-[-0.04em]">
                  {item.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                  {item.caption}
                </p>
                <div className="mt-4">
                  <Link className="queue-link" href={`/gallery/${item.identifier}`}>
                    Open media details
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { getAboutContent } from "@/lib/content/public-content";

export default async function AboutPage() {
  const aboutContent = await getAboutContent();

  return (
    <div className="shell py-12">
      <section className="glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div>
            <span className="eyebrow">{aboutContent.eyebrow}</span>
            <h1 className="section-title mt-4">{aboutContent.title}</h1>
            <p className="section-copy mt-5">{aboutContent.summary}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/membership-form" className="primary-button">
                Membership status
              </Link>
              <Link href="/events" className="secondary-button">
                Explore events
              </Link>
            </div>
          </div>

          <div className="relative min-h-[320px] overflow-hidden rounded-[1.8rem] border border-[var(--line)]">
            <Image
              alt="JnUITS workshop session"
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1024px) 48vw, 100vw"
              src={aboutContent.imageSrc}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(17,31,56,0.72)] via-[rgba(17,31,56,0.18)] to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">
                Institutional identity
              </p>
              <p className="mt-3 max-w-xl text-base leading-7 text-white/90">
                JnUITS presents its mission, values, and history with a clear
                public profile for students, alumni, and partners.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <article className="section-band">
          <p className="section-divider">Narrative</p>
          <div className="mt-6 grid gap-4">
            {aboutContent.story.map((paragraph) => (
              <p key={paragraph} className="text-base leading-8 text-[var(--muted)]">
                {paragraph}
              </p>
            ))}
          </div>
        </article>

        <article className="section-band">
          <p className="section-divider">Mission</p>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[2rem] leading-[0.98] tracking-[-0.04em]">
            {aboutContent.missionTitle}
          </h2>
          <ul className="clean-list mt-6">
            {aboutContent.missionPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="mt-8 section-band">
        <p className="section-divider">Values</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {aboutContent.values.map((value) => (
            <div
              key={value.title}
              className="rounded-[1.35rem] border border-[var(--line)] p-5"
              style={{
                background: "color-mix(in oklab, var(--card) 92%, transparent)",
              }}
            >
              <h3 className="font-[family-name:var(--font-heading)] text-2xl leading-tight">
                {value.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

import Image from "next/image";
import { getPublishedDevelopers } from "@/lib/content/public-content";

export default async function DevelopersPage() {
  const developers = await getPublishedDevelopers();
  const lead =
    developers.find(
      (developer) => "lead" in developer && Boolean(developer.lead)
    ) || developers[0];

  return (
    <div className="shell py-12">
      <section className="glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[0.96fr_1.04fr] lg:items-center">
          <div>
            <span className="eyebrow">Credits and stewardship</span>
            <h1 className="section-title mt-4">
              Public credits for the contributors behind the JnUITS platform.
            </h1>
            <p className="section-copy mt-5">
              This page acknowledges the people supporting platform delivery,
              content operations, and public digital experience.
            </p>
          </div>

          <article
            className="overflow-hidden rounded-[1.8rem] border border-[var(--line)] p-5"
            style={{
              background: "color-mix(in oklab, var(--card) 94%, transparent)",
            }}
          >
            <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
              <div className="relative mx-auto min-h-[180px] w-[180px] overflow-hidden rounded-[1.4rem] border border-[var(--line)]">
                <Image
                  alt={lead.name}
                  className="object-cover"
                  fill
                  priority
                  sizes="180px"
                  src={lead.imageSrc || "/logo.svg"}
                />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-blue)]">
                  Lead contributor
                </p>
                <h2 className="mt-3 font-[family-name:var(--font-heading)] text-[2rem] leading-[0.98] tracking-[-0.04em]">
                  {lead.name}
                </h2>
                <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
                  {lead.role}
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  {lead.bio}
                </p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="mt-8 section-band">
        <p className="section-divider">Team credits</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {developers.map((developer) => (
            <article
              key={developer.name}
              className="rounded-[1.35rem] border border-[var(--line)] p-5"
              style={{
                background: "color-mix(in oklab, var(--card) 94%, transparent)",
              }}
            >
              <div className="flex items-center gap-4">
                <div className="relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-[1rem] border border-[var(--line)]">
                  {developer.imageSrc ? (
                    <Image
                      alt={developer.name}
                      className="object-cover"
                      fill
                      sizes="72px"
                      src={developer.imageSrc}
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center font-[family-name:var(--font-heading)] text-xl"
                      style={{
                        background:
                          "color-mix(in oklab, var(--panel) 92%, transparent)",
                      }}
                    >
                      {developer.name.slice(0, 1)}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-heading)] text-[1.4rem] leading-tight">
                    {developer.name}
                  </h3>
                  <p className="text-sm font-semibold text-[var(--muted)]">
                    {developer.role}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                {developer.bio}
              </p>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-blue)]">
                {developer.focus}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

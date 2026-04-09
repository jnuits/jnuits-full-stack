import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/lib/content/projects";

const CATEGORY_COLORS: Record<string, string> = {
  web: "color-mix(in oklab,var(--brand-blue) 15%,transparent)",
  mobile: "color-mix(in oklab,#8b5cf6 15%,transparent)",
  ai: "color-mix(in oklab,#f59e0b 15%,transparent)",
  systems: "color-mix(in oklab,#10b981 15%,transparent)",
  design: "color-mix(in oklab,#ec4899 15%,transparent)",
  other: "color-mix(in oklab,var(--muted) 20%,transparent)",
};

const CATEGORY_TEXT: Record<string, string> = {
  web: "var(--brand-blue)",
  mobile: "#8b5cf6",
  ai: "#f59e0b",
  systems: "#10b981",
  design: "#ec4899",
  other: "var(--muted)",
};

function CoverPlaceholder({ category }: { category: string }) {
  const bg = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;
  const text = CATEGORY_TEXT[category] ?? CATEGORY_TEXT.other;
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ background: bg }}>
      <span className="text-sm font-bold uppercase tracking-[0.2em]" style={{ color: text }}>
        {category}
      </span>
    </div>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);

  if (!project) notFound();

  return (
    <div className="shell py-12">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <article className="glass-card overflow-hidden px-0 py-0">
        {/* Cover image */}
        <div className="relative h-64 sm:h-80 lg:h-96 w-full border-b border-[var(--line)]">
          {project.coverImageUrl ? (
            <Image
              alt={project.title}
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1280px) 1200px, 100vw"
              src={project.coverImageUrl}
            />
          ) : (
            <CoverPlaceholder category={project.category} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          {/* Category + status overlay */}
          <div className="absolute bottom-4 left-5 flex gap-2">
            <span
              className="detail-chip"
              style={{
                background: CATEGORY_COLORS[project.category],
                color: CATEGORY_TEXT[project.category],
                borderColor: "transparent",
              }}
            >
              {project.category}
            </span>
            <span className="detail-chip" style={{ background: "rgba(0,0,0,.45)", borderColor: "transparent", color: "#fff" }}>
              {project.status}
            </span>
            {project.isFeatured ? (
              <span className="detail-chip" style={{ background: "rgba(0,91,255,.3)", borderColor: "transparent", color: "var(--brand-blue)" }}>
                Featured
              </span>
            ) : null}
          </div>
        </div>

        <div className="px-6 py-8 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
            {/* Content */}
            <div>
              <span className="eyebrow">Project detail</span>
              <h1 className="section-title mt-4">{project.title}</h1>
              {project.tagline ? (
                <p className="mt-3 text-lg font-semibold text-[var(--muted)]">{project.tagline}</p>
              ) : null}

              {/* Description */}
              <div className="mt-6 grid gap-3">
                {project.description
                  ? project.description
                      .split(/\n{2,}/)
                      .map((para) => para.trim())
                      .filter(Boolean)
                      .map((para) => (
                        <p key={para} className="text-base leading-8 text-[var(--muted)]">
                          {para}
                        </p>
                      ))
                  : (
                    <p className="text-base leading-8 text-[var(--muted)]">
                      No project description has been added yet.
                    </p>
                  )}
              </div>

              {/* Tech stack */}
              {project.techStack.length > 0 ? (
                <div className="mt-6">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Tech stack
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {project.techStack.map((tech) => (
                      <span key={tech} className="detail-chip">{tech}</span>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* CTA buttons */}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/projects" className="secondary-button">
                  ← All projects
                </Link>
                {project.githubUrl ? (
                  <Link href={project.githubUrl} target="_blank" className="primary-button">
                    GitHub ↗
                  </Link>
                ) : null}
                {project.demoUrl ? (
                  <Link href={project.demoUrl} target="_blank" className="ghost-button">
                    Live demo ↗
                  </Link>
                ) : null}
              </div>
            </div>

            {/* Meta sidebar */}
            <aside className="grid gap-3">
              <div className="route-tile">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Timeline</p>
                <p className="mt-2 text-sm text-[var(--fg)]">
                  {project.startedAt
                    ? new Date(project.startedAt).toLocaleDateString("en-BD", { year: "numeric", month: "short" })
                    : "Start date TBC"}
                  {project.completedAt
                    ? ` → ${new Date(project.completedAt).toLocaleDateString("en-BD", { year: "numeric", month: "short" })}`
                    : " → Ongoing"}
                </p>
              </div>
              <div className="route-tile">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Contributors</p>
                <p className="mt-2 text-2xl font-bold">{project.contributorCount}</p>
              </div>
            </aside>
          </div>
        </div>
      </article>

      {/* ── Contributors ─────────────────────────────────────────────────── */}
      <section className="mt-8 section-band">
        <p className="section-divider">Project contributors</p>
        <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.4rem)] leading-[0.96] tracking-[-0.04em]">
          {project.contributors.length === 0
            ? "No contributors listed yet"
            : `${project.contributors.length} contributor${project.contributors.length === 1 ? "" : "s"}`}
        </h2>

        {project.contributors.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            Contributor records will appear here once an admin adds members to this project.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {project.contributors.map((contributor) => (
              <article
                key={contributor.memberId}
                className="application-card flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-[family-name:var(--font-heading)] text-xl leading-tight">
                      {contributor.fullName}
                    </h3>
                    {contributor.jnuitsId ? (
                      <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                        {contributor.jnuitsId}
                      </p>
                    ) : null}
                  </div>
                  <span className="status-pill shrink-0">{contributor.role}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {contributor.departmentName ? (
                    <span className="detail-chip">{contributor.departmentName}</span>
                  ) : null}
                  {contributor.batchNo !== null ? (
                    <span className="detail-chip">Batch {contributor.batchNo}</span>
                  ) : null}
                </div>

                {contributor.joinedAt ? (
                  <p className="text-xs text-[var(--muted)]">
                    Joined{" "}
                    {new Date(contributor.joinedAt).toLocaleDateString("en-BD", {
                      year: "numeric",
                      month: "short",
                    })}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

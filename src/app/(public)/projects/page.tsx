import Link from "next/link";
import Image from "next/image";
import { getPublishedProjects } from "@/lib/content/projects";
import { EmptyState } from "@/components/ui/empty-state";

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: "all", label: "All projects" },
  { key: "web", label: "Web" },
  { key: "mobile", label: "Mobile" },
  { key: "ai", label: "AI & ML" },
  { key: "systems", label: "Systems" },
  { key: "design", label: "Design" },
  { key: "other", label: "Other" },
];

const STATUS_FILTERS = [
  { key: "all", label: "Any status" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
];

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
  other: "var(--muted-foreground)",
};

const STATUS_STYLE: Record<string, string> = {
  active: "color-mix(in oklab,#22c55e 12%,transparent)",
  completed: "color-mix(in oklab,var(--brand-blue) 12%,transparent)",
  archived: "color-mix(in oklab,var(--muted) 12%,transparent)",
};

// ── Placeholder cover ─────────────────────────────────────────────────────────

function CoverPlaceholder({ category }: { category: string }) {
  const bg = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;
  const text = CATEGORY_TEXT[category] ?? CATEGORY_TEXT.other;
  return (
    <div
      className="flex h-full items-center justify-center"
      style={{ background: bg }}
      aria-hidden
    >
      <span
        className="text-xs font-bold uppercase tracking-[0.2em]"
        style={{ color: text }}
      >
        {category}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const categoryParam = typeof sp.category === "string" ? sp.category : "all";
  const statusParam = typeof sp.status === "string" ? sp.status : "all";

  const activeCategory =
    CATEGORIES.find((c) => c.key === categoryParam)?.key ?? "all";
  const activeStatus =
    STATUS_FILTERS.find((s) => s.key === statusParam)?.key ?? "all";

  const projects = await getPublishedProjects({
    category: activeCategory === "all" ? undefined : activeCategory,
    status: activeStatus === "all" ? undefined : activeStatus,
  });

  const featured = projects.filter((p) => p.isFeatured);
  const regular = projects.filter((p) => !p.isFeatured);

  function buildHref(cat: string, st: string) {
    const p = new URLSearchParams();
    if (cat !== "all") p.set("category", cat);
    if (st !== "all") p.set("status", st);
    const qs = p.toString();
    return qs ? `/projects?${qs}` : "/projects";
  }

  return (
    <div className="shell py-12">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="glass-card px-6 py-8 sm:px-8">
        <span className="eyebrow">JnUITS technical portfolio</span>
        <h1 className="section-title mt-4">Project showcase</h1>
        <p className="section-copy mt-4">
          A public record of technically impactful projects built by JnUITS members &mdash; web
          applications, AI tools, systems software, and design work that defines the society&apos;s
          technical identity.
        </p>

        {/* Category filter tabs */}
        <div
          className="mt-8 flex flex-wrap gap-2"
          role="tablist"
          aria-label="Project category filter"
        >
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.key}
              href={buildHref(cat.key, activeStatus)}
              role="tab"
              aria-selected={activeCategory === cat.key}
              className={activeCategory === cat.key ? "primary-button" : "secondary-button"}
            >
              {cat.label}
            </Link>
          ))}
        </div>

        {/* Status sub-filter */}
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((st) => (
            <Link
              key={st.key}
              href={buildHref(activeCategory, st.key)}
              className={`detail-chip transition-colors hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)]${activeStatus === st.key ? " border-[var(--brand-blue)] text-[var(--brand-blue)]" : ""}`}
            >
              {st.label}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Featured projects ────────────────────────────────────────────── */}
      {featured.length > 0 ? (
        <section className="mt-8 section-band">
          <p className="section-divider">Featured projects</p>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {featured.map((project) => (
              <article
                key={project.id}
                className="overflow-hidden rounded-[1.6rem] border border-[var(--line)]"
                style={{ background: "color-mix(in oklab, var(--card) 94%, transparent)" }}
              >
                <div className="relative h-52 overflow-hidden border-b border-[var(--line)]">
                  {project.coverImageUrl ? (
                    <Image
                      alt={project.title}
                      className="object-cover"
                      fill
                      sizes="(min-width: 1024px) 45vw, 100vw"
                      src={project.coverImageUrl}
                    />
                  ) : (
                    <CoverPlaceholder category={project.category} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-3 left-3 flex gap-2">
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
                    <span
                      className="detail-chip"
                      style={{
                        background: STATUS_STYLE[project.status] ?? STATUS_STYLE.archived,
                        borderColor: "transparent",
                      }}
                    >
                      {project.status}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <h2 className="font-[family-name:var(--font-heading)] text-[1.9rem] leading-[1.02] tracking-[-0.04em]">
                    {project.title}
                  </h2>
                  {project.tagline ? (
                    <p className="mt-2 text-sm font-semibold text-[var(--muted-foreground)]">
                      {project.tagline}
                    </p>
                  ) : null}

                  {/* Tech stack */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {project.techStack.map((tech) => (
                      <span key={tech} className="detail-chip text-xs">
                        {tech}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Link href={`/projects/${project.slug}`} className="primary-button">
                      View project
                    </Link>
                    {project.githubUrl ? (
                      <Link href={project.githubUrl} target="_blank" className="secondary-button">
                        GitHub ↗
                      </Link>
                    ) : null}
                    {project.demoUrl ? (
                      <Link href={project.demoUrl} target="_blank" className="ghost-button">
                        Live demo ↗
                      </Link>
                    ) : null}
                    <span className="ml-auto text-xs text-[var(--muted-foreground)]">
                      {project.contributorCount} contributor{project.contributorCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Project stream ────────────────────────────────────────────────── */}
      <section className="mt-8 section-band">
        <div className="flex items-baseline justify-between gap-4">
          <p className="section-divider">All projects</p>
          <span className="text-sm text-[var(--muted-foreground)]">
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </span>
        </div>

        {projects.length === 0 ? (
          <EmptyState
            title="No projects found"
            description={
              activeCategory !== "all" || activeStatus !== "all"
                ? "Try adjusting the category or status filter."
                : "JnUITS project portfolios are being set up. Check back soon."
            }
            actions={
              activeCategory !== "all" || activeStatus !== "all"
                ? [{ label: "View all projects", href: "/projects", variant: "secondary" as const }]
                : []
            }
            className="mt-6"
          />
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(featured.length > 0 ? regular : projects).map((project) => (
              <article
                key={project.id}
                className="application-card flex flex-col gap-4"
              >
                {/* Cover */}
                <div className="relative h-36 overflow-hidden rounded-[1.2rem] border border-[var(--line)]">
                  {project.coverImageUrl ? (
                    <Image
                      alt={project.title}
                      className="object-cover"
                      fill
                      sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw"
                      src={project.coverImageUrl}
                    />
                  ) : (
                    <CoverPlaceholder category={project.category} />
                  )}
                </div>

                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-[family-name:var(--font-heading)] text-xl leading-tight">
                      {project.title}
                    </h3>
                    {project.tagline ? (
                      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{project.tagline}</p>
                    ) : null}
                  </div>
                  <span
                    className="detail-chip shrink-0"
                    style={{
                      background: CATEGORY_COLORS[project.category],
                      color: CATEGORY_TEXT[project.category],
                      borderColor: "transparent",
                    }}
                  >
                    {project.category}
                  </span>
                </div>

                {/* Tech stack */}
                <div className="flex flex-wrap gap-1.5">
                  {project.techStack.slice(0, 5).map((tech) => (
                    <span key={tech} className="detail-chip text-xs">
                      {tech}
                    </span>
                  ))}
                  {project.techStack.length > 5 ? (
                    <span className="detail-chip text-xs text-[var(--muted-foreground)]">
                      +{project.techStack.length - 5} more
                    </span>
                  ) : null}
                </div>

                {/* Footer */}
                <div className="mt-auto flex flex-wrap items-center gap-3">
                  <Link href={`/projects/${project.slug}`} className="queue-link">
                    View project
                  </Link>
                  {project.githubUrl ? (
                    <Link href={project.githubUrl} target="_blank" className="secondary-button">
                      GitHub ↗
                    </Link>
                  ) : null}
                  <span className="ml-auto text-xs text-[var(--muted-foreground)]">
                    {project.contributorCount} contributor{project.contributorCount === 1 ? "" : "s"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

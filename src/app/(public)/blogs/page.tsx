import Image from "next/image";
import Link from "next/link";
import {
  formatDisplayDate,
  getPublishedBlogs,
} from "@/lib/content/public-content";

export default async function BlogsPage() {
  const publicBlogs = await getPublishedBlogs();
  const featuredBlog = publicBlogs[0];
  const remainingBlogs = publicBlogs.slice(1);

  return (
    <div className="shell py-12">
      <section className="glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[1.06fr_0.94fr] lg:items-center">
          <div>
            <span className="eyebrow">Public editorial lane</span>
            <h1 className="section-title mt-4">
              Stories, announcements, and technology reflections from the JnUITS community.
            </h1>
            <p className="section-copy mt-5">
              This section highlights program updates, student initiatives, and
              society activities published for members, alumni, and the wider
              public audience.
            </p>
          </div>

          <article
            className="overflow-hidden rounded-[1.8rem] border border-[var(--line)]"
            style={{
              background: "color-mix(in oklab, var(--card) 94%, transparent)",
            }}
          >
            <div className="relative h-64">
              <Image
                alt={featuredBlog.title}
                className="object-cover"
                fill
                priority
                sizes="(min-width: 1024px) 38vw, 100vw"
                src={featuredBlog.imageSrc}
              />
            </div>
            <div className="p-6">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-blue)]">
                Featured article
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-[2rem] leading-[0.98] tracking-[-0.04em]">
                {featuredBlog.title}
              </h2>
              <p className="mt-4 text-sm leading-7 text-[var(--muted-foreground)]">
                {featuredBlog.excerpt}
              </p>
              <div className="mt-6">
                <Link className="secondary-button" href={`/blogs/${featuredBlog.slug}`}>
                  Open article
                </Link>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <article className="section-band">
          <p className="section-divider">Preview articles</p>
          <div className="mt-6 grid gap-5">
            {publicBlogs.map((blog) => (
              <article
                key={blog.slug}
                className="grid gap-4 rounded-[1.4rem] border border-[var(--line)] p-5 md:grid-cols-[minmax(0,0.78fr)_minmax(220px,0.22fr)] md:items-center"
                style={{
                  background: "color-mix(in oklab, var(--card) 94%, transparent)",
                }}
              >
                <div>
                  <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    <span>{blog.category}</span>
                    <span>{formatDisplayDate(blog.publishedAt)}</span>
                    <span>{blog.readTime}</span>
                  </div>
                  <h3 className="mt-3 font-[family-name:var(--font-heading)] text-[1.75rem] leading-[1.02] tracking-[-0.04em]">
                    {blog.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                    {blog.summary}
                  </p>
                  <div className="mt-4">
                    <Link className="queue-link" href={`/blogs/${blog.slug}`}>
                      Open article
                    </Link>
                  </div>
                </div>
                <div className="relative min-h-[180px] overflow-hidden rounded-[1.25rem] border border-[var(--line)]">
                  <Image
                    alt={blog.title}
                    className="object-cover"
                    fill
                    sizes="(min-width: 768px) 22vw, 100vw"
                    src={blog.imageSrc}
                  />
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="section-band">
          <p className="section-divider">Editorial notes</p>
          <ul className="clean-list mt-6">
            <li>Articles are published for public reading after editorial moderation.</li>
            <li>Society updates include program reports, technical highlights, and community insights.</li>
            <li>Each article keeps a stable direct link for sharing and long-term reference.</li>
          </ul>
          <div className="mt-8 grid gap-4">
            {remainingBlogs.map((blog) => (
              <div
                key={blog.slug}
                className="rounded-[1.2rem] border border-[var(--line)] p-4"
                style={{
                  background: "color-mix(in oklab, var(--panel) 92%, transparent)",
                }}
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-blue)]">
                  {blog.category}
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                  {blog.excerpt}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

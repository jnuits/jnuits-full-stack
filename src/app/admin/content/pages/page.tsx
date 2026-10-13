import { requireAdminPermission } from "@/lib/auth/session";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSingletonEditor } from "@/components/admin/page-singleton-editor";
import { FileText } from "lucide-react";

type ContentPageRecord = {
  slug: string;
  status: string;
  title: string;
  eyebrow: string | null;
  summary: string | null;
  body: unknown;
  updated_at: string;
};


export const metadata = { title: "Page Singletons — Admin | JnUITS" };

export default async function PagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermission("cms.pages.manage", { fallbackPath: "/admin/dashboard" });
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const resolved = await searchParams;
  const editSlug = typeof resolved.edit === "string" && ["home", "about", "contact", "footer"].includes(resolved.edit) ? resolved.edit : "home";

  const pagesResult = await admin
    .from("content_pages")
    .select("slug, status, title, eyebrow, summary, body, updated_at")
    .order("slug", { ascending: true });

  const pages = (pagesResult.data || []) as ContentPageRecord[];
  const selected = pages.find((p) => p.slug === editSlug) || null;

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Content</p>
          <h1 className="admin-page-header__title">Page Singletons</h1>
          <p className="admin-page-header__desc">
            Edit the copy and structured content for brand-managed singleton pages: Home, About, Contact, and Footer.
          </p>
        </div>
        <span className="abadge abadge--info">{pages.length} pages</span>
      </div>

      {flash && (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="admin-section-label">Operator feedback</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">{flash.title}</h2>
          <p className="mt-1 text-sm leading-7">{flash.message}</p>
        </section>
      )}

      {/* Metrics */}
      <div className="admin-metric-grid">
        <div className="admin-metric-card" data-tone="info">
          <div className="admin-metric-card__icon"><FileText size={16} /></div>
          <p className="admin-metric-card__label">Total pages</p>
          <p className="admin-metric-card__value">{pages.length}</p>
          <p className="admin-metric-card__sub">Singleton content</p>
        </div>
        <div className="admin-metric-card" data-tone="success">
          <p className="admin-metric-card__label">Published</p>
          <p className="admin-metric-card__value">{pages.filter((p) => p.status === "published").length}</p>
          <p className="admin-metric-card__sub">Live on site</p>
        </div>
      </div>

      {/* Pages list first for easy selection */}
      <section>
        <p className="admin-section-label">Stored singleton pages</p>
        {pages.length === 0 ? (
          <EmptyState title="No pages stored yet" description="Save page content using the form below." />
        ) : (
          <div className="admin-card-list">
            {pages.map((page) => (
              <div key={page.slug} className="admin-card-row">
                <div className="admin-hub-tile__icon" style={{ flexShrink: 0 }}>
                  <FileText size={16} />
                </div>
                <div className="admin-card-row__body">
                  <p className="admin-card-row__title">{page.title}</p>
                  <p className="admin-card-row__meta">
                    /{page.slug} · Updated {new Date(page.updated_at).toLocaleDateString("en-BD")}
                  </p>
                </div>
                <div className="admin-card-row__actions">
                  <span className={`abadge abadge--${page.status === "published" ? "published" : "draft"}`}>{page.status}</span>
                  <Link href={`/admin/content/pages?edit=${page.slug}`} className="admin-btn admin-btn--ghost" style={{ padding: "0.3rem 0.75rem", fontSize: "0.77rem" }}>
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Form */}
      <section>
        <p className="admin-section-label">{selected ? `Editing: ${selected.slug}` : "Create / update page singleton"}</p>
        <PageSingletonEditor key={`${editSlug}:${selected?.updated_at || "new"}`} selected={selected} initialSlug={editSlug} />
      </section>
    </div>
  );
}


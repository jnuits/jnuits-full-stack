import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import { saveContentPost } from "@/app/admin/content/actions";
import { EmptyState } from "@/components/ui/empty-state";
import { Calendar } from "lucide-react";

type EventRecord = {
  id: string;
  slug: string;
  status: string;
  title: string;
  category: string | null;
  summary: string | null;
  body: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  cta_href: string | null;
  media_asset_id: string | null;
  updated_at: string;
  published_at: string | null;
};

type MediaAssetOption = { id: string; title: string | null; public_id: string; media_kind: string };

export const metadata = { title: "Events — Admin | JnUITS" };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const resolved = await searchParams;
  const editId = typeof resolved.edit === "string" ? resolved.edit : "";

  const [eventsResult, mediaResult] = await Promise.all([
    admin
      .from("content_posts")
      .select("id, slug, status, title, category, summary, body, starts_at, ends_at, location, cta_href, media_asset_id, updated_at, published_at")
      .eq("content_type", "event")
      .order("starts_at", { ascending: false })
      .limit(20),
    admin.from("media_assets").select("id, title, public_id, media_kind").order("created_at", { ascending: false }).limit(30),
  ]);

  const events = (eventsResult.data || []) as EventRecord[];
  const media = (mediaResult.data || []) as MediaAssetOption[];
  const selected = events.find((e) => e.id === editId) || null;
  const upcoming = events.filter((e) => e.starts_at && new Date(e.starts_at) > new Date());
  const past = events.filter((e) => e.starts_at && new Date(e.starts_at) <= new Date());

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Content</p>
          <h1 className="admin-page-header__title">Events</h1>
          <p className="admin-page-header__desc">
            Create, edit, and manage public events. Set dates, locations, and CTA links for each event.
          </p>
        </div>
        <span className="abadge abadge--active">
          <Calendar size={10} /> {upcoming.length} upcoming
        </span>
      </div>

      {flash && (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="admin-section-label">Operator feedback</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">{flash.title}</h2>
          <p className="mt-1 text-sm leading-7">{flash.message}</p>
        </section>
      )}

      {/* Metrics */}
      <div className="admin-metric-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))" }}>
        <div className="admin-metric-card" data-tone="info">
          <div className="admin-metric-card__icon"><Calendar size={16} /></div>
          <p className="admin-metric-card__label">Total events</p>
          <p className="admin-metric-card__value">{events.length}</p>
          <p className="admin-metric-card__sub">All statuses</p>
        </div>
        <div className="admin-metric-card" data-tone="success">
          <p className="admin-metric-card__label">Upcoming</p>
          <p className="admin-metric-card__value">{upcoming.length}</p>
          <p className="admin-metric-card__sub">Future events</p>
        </div>
        <div className="admin-metric-card">
          <p className="admin-metric-card__label">Past</p>
          <p className="admin-metric-card__value">{past.length}</p>
          <p className="admin-metric-card__sub">Completed</p>
        </div>
        <div className="admin-metric-card" data-tone="published">
          <p className="admin-metric-card__label">Published</p>
          <p className="admin-metric-card__value">{events.filter((e) => e.status === "published").length}</p>
          <p className="admin-metric-card__sub">Live on site</p>
        </div>
      </div>

      {/* Create / Edit Form */}
      <section>
        <p className="admin-section-label">{selected ? `Editing: ${selected.title}` : "Create new event"}</p>
        <div className="admin-review-card">
          <form action={saveContentPost} className="grid gap-4">
            <input type="hidden" name="postId" value={selected?.id || ""} />
            <input type="hidden" name="contentType" value="event" />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="input-label sm:col-span-2">
                Title
                <input defaultValue={selected?.title || ""} name="title" placeholder="Event title" required />
              </label>
              <label className="input-label">
                Slug
                <input defaultValue={selected?.slug || ""} name="slug" placeholder="generated-if-empty" />
              </label>
              <label className="input-label">
                Status
                <select defaultValue={selected?.status || "draft"} name="status">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="input-label">
                Starts at
                <input defaultValue={selected?.starts_at?.slice(0, 16) || ""} name="startsAt" type="datetime-local" />
              </label>
              <label className="input-label">
                Ends at
                <input defaultValue={selected?.ends_at?.slice(0, 16) || ""} name="endsAt" type="datetime-local" />
              </label>
              <label className="input-label sm:col-span-2">
                Location
                <input defaultValue={selected?.location || ""} name="location" placeholder="Venue or online" />
              </label>
              <label className="input-label sm:col-span-2">
                Summary
                <textarea defaultValue={selected?.summary || ""} name="summary" placeholder="Short event description" rows={3} />
              </label>
              <label className="input-label sm:col-span-2">
                Body
                <textarea defaultValue={selected?.body || ""} name="body" placeholder="Full event details" rows={6} />
              </label>
              <label className="input-label">
                CTA link
                <input defaultValue={selected?.cta_href || ""} name="ctaHref" placeholder="https:// or internal route" />
              </label>
              <label className="input-label">
                Media asset
                <select defaultValue={selected?.media_asset_id || ""} name="mediaAssetId">
                  <option value="">No media</option>
                  {media.map((a) => (
                    <option key={a.id} value={a.id}>{a.title || a.public_id}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="admin-btn admin-btn--primary" type="submit">
                {selected ? "Update event" : "Save event"}
              </button>
              {selected && (
                <Link href="/admin/content/events" className="admin-btn admin-btn--ghost">Clear editor</Link>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* Event list */}
      <section>
        <p className="admin-section-label">All events ({events.length})</p>
        {events.length === 0 ? (
          <EmptyState title="No events yet" description="Create your first event using the form above." />
        ) : (
          <div className="admin-card-list">
            {events.map((event) => {
              const isUpcoming = event.starts_at && new Date(event.starts_at) > new Date();
              return (
                <div key={event.id} className="admin-card-row">
                  <div className="admin-hub-tile__icon" style={{ flexShrink: 0 }}>
                    <Calendar size={16} />
                  </div>
                  <div className="admin-card-row__body">
                    <p className="admin-card-row__title">{event.title}</p>
                    <p className="admin-card-row__meta">
                      {event.starts_at ? new Date(event.starts_at).toLocaleDateString("en-BD") : "No date"}
                      {event.location ? ` · ${event.location}` : ""}
                    </p>
                  </div>
                  <div className="admin-card-row__actions">
                    <span className={`abadge abadge--${isUpcoming ? "active" : "draft"}`}>
                      {isUpcoming ? "Upcoming" : "Past"}
                    </span>
                    <span className={`abadge abadge--${event.status === "published" ? "published" : "draft"}`}>
                      {event.status}
                    </span>
                    <Link href={`/admin/content/events?edit=${event.id}`} className="admin-btn admin-btn--ghost" style={{ padding: "0.3rem 0.75rem", fontSize: "0.77rem" }}>
                      Edit
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

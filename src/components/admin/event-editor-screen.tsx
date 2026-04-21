import Image from "next/image";
import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  Image as ImageIcon,
  Save,
  Trash2,
} from "lucide-react";
import { AdminEditorTabs } from "@/components/admin/admin-editor-tabs";
import { EventMarkdownEditor } from "@/components/admin/event-markdown-editor";
import { EventMediaPicker } from "@/components/admin/event-media-picker";
import { saveEvent, updateEventLifecycle } from "@/app/admin/content/events/actions";
import {
  formatEventDateRange,
  getEventLocalDateInput,
  getEventLocalTimeInput,
  type EventDetail,
  toEventCategoryLabel,
} from "@/lib/content/events";

type EventEditorScreenProps = {
  event: EventDetail | null;
};

const EVENT_CATEGORY_OPTIONS = [
  "workshop-training",
  "competition",
  "member-outreach",
  "ceremony-community",
  "community-social",
  "institutional",
  "tour",
  "other-real-event",
] as const;

const EVENT_DELIVERY_OPTIONS = [
  { label: "Offline", value: "offline" },
  { label: "Online or hybrid", value: "online-or-hybrid" },
  { label: "Unknown / not finalized", value: "unknown" },
] as const;

const EVENT_LOCATION_OPTIONS = [
  { label: "Venue", value: "venue" },
  { label: "Online", value: "online" },
  { label: "Hybrid", value: "hybrid" },
  { label: "To be announced", value: "tba" },
] as const;

const EVENT_STATUS_OPTIONS = [
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
] as const;

const EVENT_REGISTRATION_OPTIONS = [
  { label: "Internal registration", value: "internal" },
  { label: "External registration", value: "external" },
  { label: "No registration", value: "none" },
] as const;

function initialSelectedAsset(event: EventDetail | null) {
  if (!event?.cover) {
    return null;
  }

  return {
    altText: event.cover.alt,
    id: event.cover.id,
    publicId: event.cover.publicId,
    secureUrl: event.cover.rawUrl,
    thumbnailUrl: event.cover.thumbnailUrl,
    title: event.title,
  };
}

function archiveLabel(event: EventDetail) {
  return event.status === "published" ? "Archive event" : "Publish event";
}

function archiveIntent(event: EventDetail) {
  return event.status === "published" ? "archive" : "publish";
}

export function EventEditorScreen({ event }: EventEditorScreenProps) {
  const isNew = !event;
  const timeZone = event?.timezone || "Asia/Dhaka";
  const tabs = [
    {
      content: (
        <div className="event-editor-grid">
          <section className="admin-review-card grid gap-4">
            <div>
              <p className="admin-section-label">Metadata and dates</p>
              <h2 className="admin-card-row__title">Public event identity</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                Keep the public title, slug, summary, timing, and venue details
                here. This tab controls how the event appears across the site.
              </p>
            </div>

            <label className="input-label">
              Title
              <input
                defaultValue={event?.title || ""}
                name="title"
                placeholder="Speak Up: Interactive Public Speaking Workshop"
                required
              />
            </label>

            <label className="input-label">
              Slug
              <input
                defaultValue={event?.slug || ""}
                name="slug"
                placeholder="speak-up-interactive-public-speaking-workshop"
                required
              />
            </label>

            <label className="input-label">
              Summary
              <textarea
                defaultValue={event?.summary || ""}
                name="summary"
                placeholder="Short summary for cards, archive previews, and search."
                rows={4}
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="input-label">
                Category
                <select defaultValue={event?.category || "workshop-training"} name="category">
                  {EVENT_CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {toEventCategoryLabel(option)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="input-label">
                Status
                <select defaultValue={event?.status || "draft"} name="status">
                  {EVENT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="input-label">
                Delivery mode
                <select
                  defaultValue={event?.deliveryMode || "offline"}
                  name="deliveryMode"
                >
                  {EVENT_DELIVERY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="input-label">
                Timezone
                <input defaultValue={timeZone} name="timezone" required />
              </label>
              <label className="input-label">
                Start date
                <input
                  defaultValue={getEventLocalDateInput(event?.startsAt, timeZone)}
                  name="startsAtDate"
                  required
                  type="date"
                />
              </label>
              <label className="input-label">
                Start time
                <input
                  defaultValue={getEventLocalTimeInput(event?.startsAt, timeZone)}
                  name="startsAtTime"
                  type="time"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="input-label">
                End date
                <input
                  defaultValue={getEventLocalDateInput(event?.endsAt, timeZone)}
                  name="endsAtDate"
                  type="date"
                />
              </label>
              <label className="input-label">
                End time
                <input
                  defaultValue={getEventLocalTimeInput(event?.endsAt, timeZone)}
                  name="endsAtTime"
                  type="time"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="input-label">
                Location mode
                <select
                  defaultValue={event?.locationMode || "venue"}
                  name="locationMode"
                >
                  {EVENT_LOCATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-label sm:col-span-2">
                Public location label
                <input
                  defaultValue={event?.locationLabel || ""}
                  name="locationLabel"
                  placeholder="CSE Department VC Room / Google Meet"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="input-label">
                Venue name
                <input
                  defaultValue={event?.venueName || ""}
                  name="venueName"
                  placeholder="CSE Department VC Room"
                />
              </label>
              <label className="input-label">
                Venue address
                <input
                  defaultValue={event?.venueAddress || ""}
                  name="venueAddress"
                  placeholder="Jagannath University, Dhaka"
                />
              </label>
            </div>

            <label className="input-label">
              Online meeting link
              <input
                defaultValue={event?.onlineUrl || ""}
                name="onlineUrl"
                placeholder="https://meet.google.com/..."
                type="url"
              />
            </label>
          </section>

          <aside className="grid gap-4">
            <section className="admin-review-card">
              <p className="admin-section-label">Public preview</p>
              <h2 className="admin-card-row__title">
                {event?.title || "New event draft"}
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="detail-chip">{event?.lifecycleLabel || "Draft"}</span>
                <span className="detail-chip">
                  {toEventCategoryLabel(event?.category || "workshop-training")}
                </span>
                {event?.registrationBadgeLabel ? (
                  <span className="detail-chip">{event.registrationBadgeLabel}</span>
                ) : null}
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--muted-foreground)]">
                {event
                  ? formatEventDateRange(event.startsAt, event.endsAt, event.timezone)
                  : "Save the event to preview its public schedule range."}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                {event?.locationLabel || "Venue or online details will appear here."}
              </p>
            </section>

            {event ? (
              <section className="admin-review-card">
                <p className="admin-section-label">Lifecycle</p>
                <h2 className="admin-card-row__title">Publishing controls</h2>
                <div className="mt-4 flex flex-wrap gap-3">
                  <form action={updateEventLifecycle}>
                    <input name="eventId" type="hidden" value={event.id} />
                    <input name="intent" type="hidden" value={archiveIntent(event)} />
                    <button className="admin-btn admin-btn--ghost" type="submit">
                      <Archive aria-hidden="true" size={15} />
                      {archiveLabel(event)}
                    </button>
                  </form>
                  <form action={updateEventLifecycle}>
                    <input name="eventId" type="hidden" value={event.id} />
                    <input name="intent" type="hidden" value="delete" />
                    <button className="admin-btn admin-btn--danger" type="submit">
                      <Trash2 aria-hidden="true" size={15} />
                      Delete event
                    </button>
                  </form>
                </div>
                {event.legacyContentPostId ? (
                  <p className="mt-4 text-xs leading-6 text-[var(--muted-foreground)]">
                    Legacy source preserved via linked content post for rollback and
                    registration compatibility.
                  </p>
                ) : (
                  <p className="mt-4 text-xs leading-6 text-[var(--muted-foreground)]">
                    This event exists only in the new Events module and will use
                    the new event registration path.
                  </p>
                )}
              </section>
            ) : null}
          </aside>
        </div>
      ),
      id: "metadata",
      label: "Metadata & Dates",
    },
    {
      content: (
        <div className="grid gap-6">
          <section className="admin-review-card grid gap-4">
            <div>
              <p className="admin-section-label">Body and links</p>
              <h2 className="admin-card-row__title">Public story and CTA logic</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                Use Markdown for the full event story. Registration and CTA
                fields below control the public buttons and registration state.
              </p>
            </div>

            <EventMarkdownEditor
              defaultValue={event?.bodyMarkdown || ""}
              name="bodyMarkdown"
              placeholder="## Event overview&#10;&#10;Describe the event, speakers, schedule, and expected outcomes."
            />
          </section>

          <section className="admin-review-card grid gap-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <label className="input-label">
                Registration mode
                <select
                  defaultValue={event?.registrationMode || "none"}
                  name="registrationMode"
                >
                  {EVENT_REGISTRATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="input-label">
                Registration URL
                <input
                  defaultValue={event?.registrationUrl || ""}
                  name="registrationUrl"
                  placeholder="https://forms.gle/..."
                  type="url"
                />
              </label>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <label className="input-label">
                Registration open
                <select
                  defaultValue={event?.registrationOpen ? "true" : "false"}
                  name="registrationOpen"
                >
                  <option value="true">Open</option>
                  <option value="false">Closed</option>
                </select>
              </label>

              <label className="input-label">
                Capacity
                <input
                  defaultValue={event?.capacity || ""}
                  name="capacity"
                  min="1"
                  placeholder="Optional seat limit"
                  type="number"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="input-label">
                Registration closes date
                <input
                  defaultValue={getEventLocalDateInput(
                    event?.registrationClosesAt,
                    timeZone
                  )}
                  name="registrationClosesAtDate"
                  type="date"
                />
              </label>
              <label className="input-label">
                Registration closes time
                <input
                  defaultValue={getEventLocalTimeInput(
                    event?.registrationClosesAt,
                    timeZone
                  )}
                  name="registrationClosesAtTime"
                  type="time"
                />
              </label>
            </div>

            <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
              <label className="input-label">
                CTA label
                <input
                  defaultValue={event?.ctaLabel || ""}
                  name="ctaLabel"
                  placeholder="Learn more"
                />
              </label>
              <label className="input-label">
                CTA URL
                <input
                  defaultValue={event?.ctaUrl || ""}
                  name="ctaUrl"
                  placeholder="https:// or /internal-route"
                />
              </label>
            </div>
          </section>
        </div>
      ),
      id: "body",
      label: "Body & Links",
    },
    {
      content: (
        <div className="event-editor-grid">
          <section className="admin-review-card grid gap-4">
            <div>
              <p className="admin-section-label">Cover media</p>
              <h2 className="admin-card-row__title">Reusable media asset</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                Pick an existing Cloudinary image from the shared media registry.
                No event image is uploaded to Supabase.
              </p>
            </div>

            <div className="relative min-h-[16rem] overflow-hidden rounded-[1.2rem] border border-[var(--line)] bg-[var(--muted)]">
              {event?.cover ? (
                <Image
                  alt={event.cover.alt}
                  className="object-cover"
                  fill
                  sizes="(min-width: 1280px) 28rem, 100vw"
                  src={event.cover.thumbnailUrl}
                />
              ) : (
                <div className="admin-gallery-list-row__placeholder h-full">
                  <ImageIcon aria-hidden="true" size={20} />
                  <span>No cover selected yet</span>
                </div>
              )}
            </div>

            <label className="input-label">
              Cover alt text override
              <input
                defaultValue={event?.coverAltTextOverride || ""}
                name="coverAltTextOverride"
                placeholder="Optional public alt text specific to this event"
              />
            </label>
          </section>

          <EventMediaPicker initialSelectedAsset={initialSelectedAsset(event)} />
        </div>
      ),
      id: "media",
      label: "Media",
    },
  ];

  return (
    <div className="grid gap-7">
      <header className="admin-page-header">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Link className="queue-link" href="/admin/content/events">
              <ArrowLeft aria-hidden="true" className="mr-1 inline" size={14} />
              Back to events
            </Link>
            {event ? (
              <span className="status-pill">
                {event.status} • {event.lifecycleLabel}
              </span>
            ) : null}
          </div>
          <p className="admin-page-header__breadcrumb mt-4">Admin / Content / Events</p>
          <h1 className="admin-page-header__title">
            {isNew ? "New event" : event.title}
          </h1>
          <p className="admin-page-header__desc">
            {isNew
              ? "Create a dedicated event record with structured dates, registration settings, and a reusable cover asset."
              : "Edit metadata, public markdown, registration settings, and the reusable event cover from one workspace."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {event?.status === "published" ? (
            <Link
              className="admin-btn admin-btn--ghost"
              href={`/events/${event.slug}`}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" size={15} />
              View public
            </Link>
          ) : null}
          <button className="admin-btn admin-btn--primary" form="event-editor-form" type="submit">
            <Save aria-hidden="true" size={15} />
            Save event
          </button>
        </div>
      </header>

      <form action={saveEvent} className="grid gap-6" id="event-editor-form">
        <input name="eventId" type="hidden" value={event?.id || ""} />

        <section className="event-editor-summary-grid">
          <article className="admin-review-card">
            <p className="admin-section-label">Schedule</p>
            <h2 className="admin-card-row__title">
              {event
                ? formatEventDateRange(event.startsAt, event.endsAt, event.timezone)
                : "Choose the start date and time"}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="detail-chip">
                <CalendarClock aria-hidden="true" size={14} />
                {event?.locationLabel || "Venue pending"}
              </span>
              <span className="detail-chip">
                {toEventCategoryLabel(event?.category || "workshop-training")}
              </span>
            </div>
          </article>

          <article className="admin-review-card">
            <p className="admin-section-label">Registration</p>
            <h2 className="admin-card-row__title">
              {event?.registrationBadgeLabel || "No registration badge yet"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
              {event
                ? `Registered attendees: ${event.registeredCount}${
                    typeof event.capacity === "number"
                      ? ` / ${event.capacity} capacity`
                      : ""
                  }`
                : "Internal, external, or no-registration flows can be configured from the editor."}
            </p>
          </article>
        </section>

        <AdminEditorTabs tabs={tabs} />

        <div className="flex flex-wrap justify-end gap-3">
          <Link className="admin-btn admin-btn--ghost" href="/admin/content/events">
            Cancel
          </Link>
          <button className="admin-btn admin-btn--primary" type="submit">
            <Save aria-hidden="true" size={15} />
            Save event
          </button>
        </div>
      </form>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  Image as ImageIcon,
  MapPin,
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
  const formDefaults = {
    bodyMarkdown: event?.bodyMarkdown || "",
    capacity: event?.capacity || "",
    category: event?.category || "workshop-training",
    coverAltTextOverride: event?.coverAltTextOverride || "",
    ctaLabel: event?.ctaLabel || "",
    ctaUrl: event?.ctaUrl || "",
    deliveryMode: event?.deliveryMode || "offline",
    endsAtDate: getEventLocalDateInput(event?.endsAt, timeZone),
    endsAtTime: getEventLocalTimeInput(event?.endsAt, timeZone),
    locationLabel: event?.locationLabel || "",
    locationMode: event?.locationMode || "venue",
    onlineUrl: event?.onlineUrl || "",
    registrationClosesAtDate: getEventLocalDateInput(
      event?.registrationClosesAt,
      timeZone
    ),
    registrationClosesAtTime: getEventLocalTimeInput(
      event?.registrationClosesAt,
      timeZone
    ),
    registrationMode: event?.registrationMode || "none",
    registrationOpen: event?.registrationOpen ? "true" : "false",
    registrationUrl: event?.registrationUrl || "",
    slug: event?.slug || "",
    startsAtDate: getEventLocalDateInput(event?.startsAt, timeZone),
    startsAtTime: getEventLocalTimeInput(event?.startsAt, timeZone),
    status: event?.status || "draft",
    summary: event?.summary || "",
    timezone: timeZone,
    title: event?.title || "",
    venueAddress: event?.venueAddress || "",
    venueName: event?.venueName || "",
  };
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

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
              <label className="input-label">
                Title
                <input
                  autoComplete="off"
                  defaultValue={formDefaults.title}
                  id="event-title"
                  name="title"
                  placeholder="Speak Up: Interactive Public Speaking Workshop"
                  required
                />
              </label>

              <label className="input-label">
                Slug
                <input
                  autoComplete="off"
                  defaultValue={formDefaults.slug}
                  id="event-slug"
                  name="slug"
                  placeholder="speak-up-interactive-public-speaking-workshop"
                  required
                />
              </label>
            </div>

            <label className="input-label">
              Summary
              <textarea
                autoComplete="off"
                defaultValue={formDefaults.summary}
                id="event-summary"
                name="summary"
                placeholder="Short summary for cards, archive previews, and search."
                rows={4}
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="input-label">
                Category
                <select
                  defaultValue={formDefaults.category}
                  id="event-category"
                  name="category"
                >
                  {EVENT_CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {toEventCategoryLabel(option)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="input-label">
                Status
                <select
                  defaultValue={formDefaults.status}
                  id="event-status"
                  name="status"
                >
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
                  defaultValue={formDefaults.deliveryMode}
                  id="event-delivery-mode"
                  name="deliveryMode"
                >
                  {EVENT_DELIVERY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="input-label">
                Timezone
                <input
                  autoComplete="off"
                  defaultValue={formDefaults.timezone}
                  id="event-timezone"
                  name="timezone"
                  required
                />
              </label>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                <label className="input-label">
                  Start date
                  <input
                    autoComplete="off"
                    defaultValue={formDefaults.startsAtDate}
                    id="event-starts-at-date"
                    name="startsAtDate"
                    required
                    type="date"
                  />
                </label>
                <label className="input-label">
                  Start time
                  <input
                    autoComplete="off"
                    defaultValue={formDefaults.startsAtTime}
                    id="event-starts-at-time"
                    name="startsAtTime"
                    type="time"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                <label className="input-label">
                  End date
                  <input
                    autoComplete="off"
                    defaultValue={formDefaults.endsAtDate}
                    id="event-ends-at-date"
                    name="endsAtDate"
                    type="date"
                  />
                </label>
                <label className="input-label">
                  End time
                  <input
                    autoComplete="off"
                    defaultValue={formDefaults.endsAtTime}
                    id="event-ends-at-time"
                    name="endsAtTime"
                    type="time"
                  />
                </label>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[14rem_minmax(0,1fr)]">
              <label className="input-label">
                Location mode
                <select
                  defaultValue={formDefaults.locationMode}
                  id="event-location-mode"
                  name="locationMode"
                >
                  {EVENT_LOCATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-label">
                Public location label
                <input
                  autoComplete="off"
                  defaultValue={formDefaults.locationLabel}
                  id="event-location-label"
                  name="locationLabel"
                  placeholder="CSE Department VC Room / Google Meet"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="input-label">
                Venue name
                <input
                  autoComplete="off"
                  defaultValue={formDefaults.venueName}
                  id="event-venue-name"
                  name="venueName"
                  placeholder="CSE Department VC Room"
                />
              </label>
              <label className="input-label">
                Venue address
                <input
                  autoComplete="off"
                  defaultValue={formDefaults.venueAddress}
                  id="event-venue-address"
                  name="venueAddress"
                  placeholder="Jagannath University, Dhaka"
                />
              </label>
            </div>

            <label className="input-label">
              Online meeting link
              <input
                autoComplete="off"
                defaultValue={formDefaults.onlineUrl}
                id="event-online-url"
                name="onlineUrl"
                placeholder="https://meet.google.com/..."
                type="url"
              />
            </label>
          </section>

          <aside className="grid gap-4">
            <section className="admin-review-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="admin-section-label">Public preview</p>
                  <h2 className="admin-card-row__title">Mini card preview</h2>
                </div>
                {event?.status === "published" ? (
                  <Link
                    className="queue-link"
                    href={`/events/${event.slug}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open public
                  </Link>
                ) : null}
              </div>

              <article className="event-editor-preview-card mt-4">
                <div className="event-editor-preview-card__media">
                  {event?.cover ? (
                    <Image
                      alt={event.cover.alt}
                      className="object-cover"
                      fill
                      sizes="(min-width: 1200px) 28rem, 100vw"
                      src={event.cover.thumbnailUrl}
                    />
                  ) : (
                    <div className="event-card__placeholder">
                      <ImageIcon aria-hidden="true" size={18} />
                      <span>No preview cover yet</span>
                    </div>
                  )}
                </div>
                <div className="event-editor-preview-card__body">
                  <div className="flex flex-wrap gap-2">
                    <span className="detail-chip">{event?.lifecycleLabel || "Draft"}</span>
                    <span className="detail-chip">
                      {toEventCategoryLabel(event?.category || "workshop-training")}
                    </span>
                    {event?.registrationBadgeLabel ? (
                      <span className="detail-chip">
                        {event.registrationBadgeLabel}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-4 font-[family-name:var(--font-heading)] text-[1.45rem] leading-[1.02] tracking-[-0.04em]">
                    {event?.title || "New event draft"}
                  </h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted-foreground)]">
                    {event?.summary ||
                      "Save the event to generate a compact public preview with dates, location, and registration state."}
                  </p>
                  <div className="mt-4 grid gap-2 text-sm text-[var(--muted-foreground)]">
                    <span className="inline-flex items-center gap-2">
                      <CalendarClock aria-hidden="true" size={15} />
                      {event
                        ? formatEventDateRange(
                            event.startsAt,
                            event.endsAt,
                            event.timezone
                          )
                        : "Schedule preview will appear here."}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <MapPin aria-hidden="true" size={15} />
                      {event?.locationLabel || "Venue or online details will appear here."}
                    </span>
                  </div>
                </div>
              </article>
            </section>

            {event ? (
              <section className="admin-review-card">
                <p className="admin-section-label">Lifecycle</p>
                <h2 className="admin-card-row__title">Publishing controls</h2>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    className="admin-btn admin-btn--ghost"
                    formAction={updateEventLifecycle.bind(
                      null,
                      archiveIntent(event)
                    )}
                    formNoValidate
                    type="submit"
                  >
                    <Archive aria-hidden="true" size={15} />
                    {archiveLabel(event)}
                  </button>
                  <button
                    className="admin-btn admin-btn--danger"
                    formAction={updateEventLifecycle.bind(null, "delete")}
                    formNoValidate
                    type="submit"
                  >
                    <Trash2 aria-hidden="true" size={15} />
                    Delete event
                  </button>
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
              defaultValue={formDefaults.bodyMarkdown}
              name="bodyMarkdown"
              placeholder="## Event overview&#10;&#10;Describe the event, speakers, schedule, and expected outcomes."
            />
          </section>

          <section className="admin-review-card grid gap-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <label className="input-label">
                Registration mode
                <select
                  defaultValue={formDefaults.registrationMode}
                  id="event-registration-mode"
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
                  autoComplete="off"
                  defaultValue={formDefaults.registrationUrl}
                  id="event-registration-url"
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
                  defaultValue={formDefaults.registrationOpen}
                  id="event-registration-open"
                  name="registrationOpen"
                >
                  <option value="true">Open</option>
                  <option value="false">Closed</option>
                </select>
              </label>

              <label className="input-label">
                Capacity
                <input
                  autoComplete="off"
                  defaultValue={formDefaults.capacity}
                  id="event-capacity"
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
                  autoComplete="off"
                  defaultValue={formDefaults.registrationClosesAtDate}
                  id="event-registration-closes-date"
                  name="registrationClosesAtDate"
                  type="date"
                />
              </label>
              <label className="input-label">
                Registration closes time
                <input
                  autoComplete="off"
                  defaultValue={formDefaults.registrationClosesAtTime}
                  id="event-registration-closes-time"
                  name="registrationClosesAtTime"
                  type="time"
                />
              </label>
            </div>

            <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
              <label className="input-label">
                CTA label
                <input
                  autoComplete="off"
                  defaultValue={formDefaults.ctaLabel}
                  id="event-cta-label"
                  name="ctaLabel"
                  placeholder="Learn more"
                />
              </label>
              <label className="input-label">
                CTA URL
                <input
                  autoComplete="off"
                  defaultValue={formDefaults.ctaUrl}
                  id="event-cta-url"
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
                autoComplete="off"
                defaultValue={formDefaults.coverAltTextOverride}
                id="event-cover-alt-override"
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
      <header className="admin-page-header admin-page-header--event-editor admin-page-header--sticky">
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
        <div className="admin-page-header__actions">
          {event?.registrationMode === "internal" ? (
            <Link
              className="admin-btn admin-btn--ghost"
              href={`/admin/content/events/${event.id}/operations`}
            >
              <CalendarClock aria-hidden="true" size={15} />
              Attendee operations
            </Link>
          ) : null}
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

      <form
        action={saveEvent}
        autoComplete="off"
        className="grid gap-6"
        id="event-editor-form"
      >
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

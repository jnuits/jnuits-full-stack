import Image from "next/image";
import Link from "next/link";
import {
  Archive,
  CalendarClock,
  Camera,
  ExternalLink,
  MapPin,
  MoreHorizontal,
  Pencil,
  Radio,
  Trash2,
} from "lucide-react";
import type { AdminEventListItem as AdminEventListRow } from "@/lib/content/events";
import {
  formatEventAdminDate,
  toEventDeliveryModeLabel,
  toEventCategoryLabel,
} from "@/lib/content/events";
import { updateEventLifecycle } from "@/app/admin/content/events/actions";

type AdminEventListItemProps = {
  event: AdminEventListRow;
};

function badgeClass(status: string) {
  if (status === "published") {
    return "abadge--published";
  }

  if (status === "archived") {
    return "abadge--draft";
  }

  return "abadge--active";
}

function lifecycleIntent(status: string) {
  return status === "published" ? "archive" : "publish";
}

function lifecycleLabel(status: string) {
  return status === "published" ? "Archive Event" : "Publish Event";
}

export function AdminEventListItem({ event }: AdminEventListItemProps) {
  return (
    <article className="admin-gallery-list-row admin-gallery-list-row--event">
      <div className="admin-gallery-list-row__thumb">
        {event.cover ? (
          <Image
            alt={event.cover.alt}
            className="object-cover"
            fill
            sizes="6rem"
            src={event.cover.thumbnailUrl}
          />
        ) : (
          <div className="admin-gallery-list-row__placeholder">
            <Camera aria-hidden="true" size={18} />
            <span>No cover</span>
          </div>
        )}
      </div>

      <div className="admin-gallery-list-row__body">
        <div className="admin-gallery-list-row__meta-row">
          <span className={`abadge ${badgeClass(event.status)}`}>{event.status}</span>
          <span className="abadge abadge--info">{event.lifecycleLabel}</span>
          <span className="abadge">{toEventCategoryLabel(event.category)}</span>
          {event.registrationBadgeLabel ? (
            <span className="abadge">{event.registrationBadgeLabel}</span>
          ) : null}
        </div>
        <h2 className="admin-gallery-list-row__title">{event.title}</h2>
        <p className="admin-gallery-list-row__meta">/events/{event.slug}</p>
        <div className="admin-event-list-row__facts">
          <span className="admin-event-list-row__fact">
            <CalendarClock aria-hidden="true" size={13} />
            {formatEventAdminDate(event.startsAt, event.endsAt, event.timezone)}
          </span>
          <span className="admin-event-list-row__fact">
            <MapPin aria-hidden="true" size={13} />
            {event.locationLabel}
          </span>
          <span className="admin-event-list-row__fact admin-event-list-row__fact--mode">
            <Radio aria-hidden="true" size={13} />
            {toEventDeliveryModeLabel(event.deliveryMode)}
          </span>
        </div>
        <p className="admin-gallery-list-row__description admin-gallery-list-row__description--clamp-2">
          {event.summary}
        </p>
      </div>

      <div className="admin-gallery-list-row__actions">
        <Link
          className="admin-btn admin-btn--primary"
          href={`/admin/content/events/${event.id}`}
        >
          Open editor
        </Link>
        <details className="admin-actions-menu">
          <summary
            aria-label={`More actions for ${event.title}`}
            className="admin-actions-menu__trigger"
            title="More actions"
          >
            <MoreHorizontal aria-hidden="true" size={17} />
          </summary>
          <div className="admin-actions-menu__panel">
            <Link
              className="admin-actions-menu__item"
              href={`/admin/content/events/${event.id}`}
            >
              <Pencil aria-hidden="true" size={15} />
              Edit Metadata
            </Link>
            {event.status === "published" ? (
              <Link
                className="admin-actions-menu__item"
                href={`/events/${event.slug}`}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink aria-hidden="true" size={15} />
                View Public Event
              </Link>
            ) : null}
            <form action={updateEventLifecycle}>
              <input name="eventId" type="hidden" value={event.id} />
              <input
                name="intent"
                type="hidden"
                value={lifecycleIntent(event.status)}
              />
              <button className="admin-actions-menu__item" type="submit">
                <Archive aria-hidden="true" size={15} />
                {lifecycleLabel(event.status)}
              </button>
            </form>
            <form action={updateEventLifecycle}>
              <input name="eventId" type="hidden" value={event.id} />
              <input name="intent" type="hidden" value="delete" />
              <button
                className="admin-actions-menu__item admin-actions-menu__item--danger"
                type="submit"
              >
                <Trash2 aria-hidden="true" size={15} />
                Delete
              </button>
            </form>
          </div>
        </details>
      </div>
    </article>
  );
}

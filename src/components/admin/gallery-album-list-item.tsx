import Image from "next/image";
import Link from "next/link";
import {
  Archive,
  Camera,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { updateGalleryAlbumLifecycle } from "@/app/admin/content/gallery/actions";
import { transformCloudinaryUrl } from "@/lib/cloudinary/urls";

export type AdminGalleryAlbumListItemAlbum = {
  category: string;
  cloudinary_folder: string | null;
  deleted_at: string | null;
  description: string | null;
  ends_on: string | null;
  event_name: string | null;
  featured: boolean;
  id: string;
  slug: string;
  starts_on: string | null;
  status: string;
  title: string;
  updated_at: string;
  year: number;
};

type AdminGalleryAlbumListItemProps = {
  album: AdminGalleryAlbumListItemAlbum;
  coverUrl?: string;
  imageCount: number;
  seedPreviewMode: boolean;
};

function toLabel(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusBadgeClass(album: Pick<AdminGalleryAlbumListItemAlbum, "deleted_at" | "status">) {
  if (album.deleted_at) {
    return "abadge--rejected";
  }

  if (album.status === "published") {
    return "abadge--published";
  }

  if (album.status === "archived") {
    return "abadge--draft";
  }

  return "abadge--active";
}

function formatAlbumDate(album: Pick<AdminGalleryAlbumListItemAlbum, "ends_on" | "starts_on" | "year">) {
  if (!album.starts_on) {
    return String(album.year);
  }

  const formatter = new Intl.DateTimeFormat("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const start = formatter.format(new Date(album.starts_on));

  if (!album.ends_on || album.ends_on === album.starts_on) {
    return start;
  }

  return `${start} - ${formatter.format(new Date(album.ends_on))}`;
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function lifecycleCopy(album: AdminGalleryAlbumListItemAlbum) {
  if (album.deleted_at) {
    return {
      icon: <RotateCcw aria-hidden="true" size={15} />,
      intent: "restore",
      label: "Restore Album",
    };
  }

  if (album.status === "published") {
    return {
      icon: <Archive aria-hidden="true" size={15} />,
      intent: "archive",
      label: "Archive Album",
    };
  }

  return {
    icon: <Archive aria-hidden="true" size={15} />,
    intent: "publish",
    label: "Publish Album",
  };
}

export function AdminGalleryAlbumListItem({
  album,
  coverUrl,
  imageCount,
  seedPreviewMode,
}: AdminGalleryAlbumListItemProps) {
  const lifecycle = lifecycleCopy(album);

  return (
    <article className="admin-gallery-list-row">
      <div className="admin-gallery-list-row__thumb">
        {coverUrl ? (
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="6rem"
            src={transformCloudinaryUrl(coverUrl, "albumCard")}
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
          <span className={`abadge ${statusBadgeClass(album)}`}>
            {album.deleted_at ? "deleted" : album.status}
          </span>
          <span className="abadge abadge--info">{album.year}</span>
          <span className="abadge">{toLabel(album.category)}</span>
          <span className="abadge">{imageCount} images</span>
          {album.featured ? <span className="abadge abadge--info">Featured</span> : null}
        </div>
        <h2 className="admin-gallery-list-row__title">{album.title}</h2>
        <p className="admin-gallery-list-row__meta">
          /gallery/{album.slug} · {formatAlbumDate(album)} · Updated{" "}
          {formatUpdatedAt(album.updated_at)}
        </p>
        <p className="admin-gallery-list-row__meta">
          Event: {album.event_name || album.title}
          {album.cloudinary_folder ? ` · Folder: ${album.cloudinary_folder}` : ""}
        </p>
        {album.description ? (
          <p className="admin-gallery-list-row__description">
            {album.description}
          </p>
        ) : null}
      </div>

      <div className="admin-gallery-list-row__actions">
        <Link
          className="admin-btn admin-btn--primary"
          href={`/admin/content/gallery/${album.id}`}
        >
          Manage Media
        </Link>
        <details className="admin-actions-menu">
          <summary
            aria-label={`More actions for ${album.title}`}
            className="admin-actions-menu__trigger"
            title="More actions"
          >
            <MoreHorizontal aria-hidden="true" size={17} />
          </summary>
          <div className="admin-actions-menu__panel">
            <Link
              className="admin-actions-menu__item"
              href={`/admin/content/gallery/${album.id}#metadata`}
            >
              <Pencil aria-hidden="true" size={15} />
              Edit Metadata
            </Link>
            <Link
              className="admin-actions-menu__item"
              href={`/gallery/${album.slug}`}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" size={15} />
              View Public Album
            </Link>
            {!seedPreviewMode ? (
              <form action={updateGalleryAlbumLifecycle}>
                <input name="albumId" type="hidden" value={album.id} />
                <input name="intent" type="hidden" value={lifecycle.intent} />
                <button className="admin-actions-menu__item" type="submit">
                  {lifecycle.icon}
                  {lifecycle.label}
                </button>
              </form>
            ) : null}
            {!seedPreviewMode && !album.deleted_at ? (
              <form action={updateGalleryAlbumLifecycle}>
                <input name="albumId" type="hidden" value={album.id} />
                <input name="intent" type="hidden" value="delete" />
                <button
                  className="admin-actions-menu__item admin-actions-menu__item--danger"
                  type="submit"
                >
                  <Trash2 aria-hidden="true" size={15} />
                  Delete
                </button>
              </form>
            ) : null}
          </div>
        </details>
      </div>
    </article>
  );
}

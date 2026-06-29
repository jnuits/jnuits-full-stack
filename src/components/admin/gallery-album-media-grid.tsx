"use client";

import Image from "next/image";
import { Archive, Edit3, GripVertical, Image as ImageIcon, RotateCcw, Save, X } from "lucide-react";
import { useState } from "react";

export type GalleryAlbumMediaGridItem = {
  altText: string;
  blurDataURL: string | null;
  deletedAt: string | null;
  description: string;
  height: number;
  id: string;
  imageUrl: string;
  isCover: boolean;
  sortOrder: number;
  status: string;
  title: string;
  width: number;
};

type ServerAction = (formData: FormData) => void | Promise<void>;

type GalleryAlbumMediaGridProps = {
  albumId: string;
  bulkAction: ServerAction;
  disabled?: boolean;
  itemAction: ServerAction;
  items: GalleryAlbumMediaGridItem[];
  reorderAction: ServerAction;
};

function statusBadgeClass(status: string, deletedAt?: string | null) {
  if (deletedAt) {
    return "abadge--rejected";
  }

  if (status === "published") {
    return "abadge--published";
  }

  if (status === "archived") {
    return "abadge--draft";
  }

  return "abadge--active";
}

function hasSameOrder(
  currentItems: GalleryAlbumMediaGridItem[],
  originalItems: GalleryAlbumMediaGridItem[]
) {
  if (currentItems.length !== originalItems.length) {
    return false;
  }

  return currentItems.every((item, index) => item.id === originalItems[index]?.id);
}

export function GalleryAlbumMediaGrid({
  albumId,
  bulkAction,
  disabled = false,
  itemAction,
  items,
  reorderAction,
}: GalleryAlbumMediaGridProps) {
  const [orderedItems, setOrderedItems] = useState(items);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const editingItem =
    orderedItems.find((item) => item.id === editingItemId) || null;
  const orderChanged = !hasSameOrder(orderedItems, items);
  const allSelected =
    orderedItems.length > 0 &&
    orderedItems.every((item) => selectedIds.includes(item.id));

  function toggleSelected(itemId: string) {
    setSelectedIds((current) =>
      current.includes(itemId)
        ? current.filter((selectedId) => selectedId !== itemId)
        : [...current, itemId]
    );
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : orderedItems.map((item) => item.id));
  }

  function moveItem(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      return;
    }

    setOrderedItems((current) => {
      const next = [...current];
      const fromIndex = next.findIndex((item) => item.id === draggedId);
      const toIndex = next.findIndex((item) => item.id === targetId);

      if (fromIndex === -1 || toIndex === -1) {
        return current;
      }

      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      return next;
    });
  }

  if (!orderedItems.length) {
    return (
      <div className="empty-state">
        No photos are attached to this album yet. Upload images to Cloudinary
        above to register media metadata and album links.
      </div>
    );
  }

  return (
    <section className="admin-media-workspace">
      <div className="admin-media-toolbar">
        <div>
          <p className="admin-section-label">Media grid</p>
          <h2 className="admin-card-row__title">
            {orderedItems.length} active image{orderedItems.length === 1 ? "" : "s"}
          </h2>
        </div>
        <div className="admin-media-toolbar__actions">
          <button
            className="admin-btn admin-btn--ghost"
            disabled={disabled}
            onClick={toggleAll}
            type="button"
          >
            {allSelected ? "Clear selection" : "Select all"}
          </button>
          <form action={reorderAction} className="contents">
            <input name="albumId" type="hidden" value={albumId} />
            {orderedItems.map((item) => (
              <input key={item.id} name="itemIds" type="hidden" value={item.id} />
            ))}
            <button
              className="admin-btn admin-btn--primary"
              disabled={disabled || !orderChanged}
              type="submit"
            >
              <Save size={15} />
              Save order
            </button>
          </form>
        </div>
      </div>

      <div className="admin-media-grid" role="list">
        {orderedItems.map((item, index) => (
          <article
            className="admin-media-card"
            data-dragging={draggedId === item.id ? "true" : undefined}
            draggable={!disabled}
            key={item.id}
            onDragEnd={() => setDraggedId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDragStart={() => setDraggedId(item.id)}
            onDrop={() => moveItem(item.id)}
            role="listitem"
          >
            <div className="admin-media-card__image">
              <label className="admin-media-card__select">
                <input
                  checked={selectedIds.includes(item.id)}
                  disabled={disabled}
                  onChange={() => toggleSelected(item.id)}
                  type="checkbox"
                />
                <span className="sr-only">Select {item.title}</span>
              </label>
              <span className="admin-media-card__drag" title="Drag to reorder">
                <GripVertical size={16} />
              </span>
              {item.imageUrl ? (
                <Image
                  alt={item.altText || item.title}
                  blurDataURL={item.blurDataURL || undefined}
                  className="object-cover"
                  draggable={false}
                  fill
                  placeholder={item.blurDataURL ? "blur" : "empty"}
                  sizes="(min-width: 1280px) 18vw, (min-width: 900px) 25vw, (min-width: 640px) 33vw, 50vw"
                  src={item.imageUrl}
                />
              ) : (
                <div className="admin-media-card__placeholder">
                  <ImageIcon size={22} />
                </div>
              )}
              <button
                className="admin-media-card__edit"
                disabled={disabled}
                onClick={() => setEditingItemId(item.id)}
                title={`Edit ${item.title}`}
                type="button"
              >
                <Edit3 size={16} />
                <span className="sr-only">Edit {item.title}</span>
              </button>
            </div>
            <div className="admin-media-card__meta">
              <span className={`abadge ${statusBadgeClass(item.status, item.deletedAt)}`}>
                {item.deletedAt ? "removed" : item.status}
              </span>
              {item.isCover ? <span className="abadge abadge--info">Cover</span> : null}
              <span className="admin-media-card__index">#{index + 1}</span>
            </div>
            <p className="admin-media-card__title">{item.title}</p>
          </article>
        ))}
      </div>

      {selectedIds.length ? (
        <form action={bulkAction} className="admin-media-bulk-bar">
          <input name="albumId" type="hidden" value={albumId} />
          {selectedIds.map((itemId) => (
            <input key={itemId} name="itemIds" type="hidden" value={itemId} />
          ))}
          <div>
            <strong>{selectedIds.length} selected</strong>
            <span> Media files remain in Cloudinary.</span>
          </div>
          <label>
            <span className="sr-only">Bulk action</span>
            <select defaultValue="archive" disabled={disabled} name="intent">
              <option value="publish">Publish selected</option>
              <option value="archive">Archive selected</option>
              <option value="delete">Soft-delete selected</option>
              <option value="remove">Remove from album</option>
            </select>
          </label>
          <button className="admin-btn admin-btn--primary" disabled={disabled} type="submit">
            <Archive size={15} />
            Run action
          </button>
          <button
            className="admin-btn admin-btn--ghost"
            onClick={() => setSelectedIds([])}
            type="button"
          >
            <X size={15} />
            Clear
          </button>
        </form>
      ) : null}

      {editingItem ? (
        <div className="admin-media-drawer" role="presentation">
          <button
            aria-label="Close image editor"
            className="admin-media-drawer__backdrop"
            onClick={() => setEditingItemId(null)}
            type="button"
          />
          <aside
            aria-labelledby="admin-media-drawer-title"
            aria-modal="true"
            className="admin-media-drawer__panel"
            role="dialog"
          >
            <div className="admin-media-drawer__header">
              <div>
                <p className="admin-section-label">Image metadata</p>
                <h2 className="admin-card-row__title" id="admin-media-drawer-title">
                  Edit photo
                </h2>
              </div>
              <button
                className="admin-icon-button"
                onClick={() => setEditingItemId(null)}
                type="button"
              >
                <X size={16} />
                <span className="sr-only">Close</span>
              </button>
            </div>

            <div className="admin-media-drawer__preview">
              {editingItem.imageUrl ? (
                <Image
                  alt={editingItem.altText || editingItem.title}
                  className="object-cover"
                  fill
                  sizes="24rem"
                  src={editingItem.imageUrl}
                />
              ) : (
                <div className="admin-media-card__placeholder">
                  <ImageIcon size={24} />
                </div>
              )}
            </div>

            <form
              action={itemAction}
              className="grid gap-4"
              key={editingItem.id}
            >
              <input name="albumId" type="hidden" value={albumId} />
              <input name="itemId" type="hidden" value={editingItem.id} />
              <label className="input-label">
                Title
                <input defaultValue={editingItem.title} name="title" />
              </label>
              <label className="input-label">
                Alt text
                <input defaultValue={editingItem.altText} name="altText" />
              </label>
              <label className="input-label">
                Short description
                <textarea
                  defaultValue={editingItem.description}
                  name="description"
                  placeholder="Optional. Keep this short and specific to the photo."
                  rows={4}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="input-label">
                  Sort
                  <input
                    defaultValue={editingItem.sortOrder}
                    name="sortOrder"
                    type="number"
                  />
                </label>
                <label className="input-label">
                  Status
                  <select defaultValue={editingItem.status} name="status">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label className="input-label">
                  Cover
                  <select
                    defaultValue={editingItem.isCover ? "true" : "false"}
                    name="isCover"
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                <button className="admin-btn admin-btn--primary" disabled={disabled} type="submit">
                  <Save size={15} />
                  Save metadata
                </button>
                <button
                  className="admin-btn admin-btn--ghost"
                  onClick={() => setEditingItemId(null)}
                  type="button"
                >
                  <RotateCcw size={15} />
                  Cancel
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { useState } from "react";

type ReorderItem = {
  id: string;
  title: string;
};

type GalleryAlbumReorderPanelProps = {
  action: (formData: FormData) => void | Promise<void>;
  albumId: string;
  items: ReorderItem[];
};

export function GalleryAlbumReorderPanel({
  action,
  albumId,
  items,
}: GalleryAlbumReorderPanelProps) {
  const [orderedItems, setOrderedItems] = useState(items);
  const [draggedId, setDraggedId] = useState<string | null>(null);

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

  if (items.length < 2) {
    return null;
  }

  return (
    <form action={action} className="admin-review-card grid gap-4">
      <input name="albumId" type="hidden" value={albumId} />
      <div>
        <p className="admin-section-label">Drag reorder</p>
        <h2 className="admin-card-row__title">Reorder album images</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
          Drag images into the preferred order, then save. This updates sort
          order only; media files are untouched.
        </p>
      </div>
      <div className="grid max-h-96 gap-2 overflow-auto pr-1">
        {orderedItems.map((item, index) => (
          <label
            className="flex cursor-grab items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-sm"
            draggable
            key={item.id}
            onDragEnd={() => setDraggedId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDragStart={() => setDraggedId(item.id)}
            onDrop={() => moveItem(item.id)}
          >
            <input name="itemIds" type="hidden" value={item.id} />
            <span className="min-w-0 truncate font-semibold">
              {item.title || `Image ${index + 1}`}
            </span>
            <span className="ml-3 flex-none text-[var(--muted-foreground)]">
              #{index + 1}
            </span>
          </label>
        ))}
      </div>
      <button className="admin-btn admin-btn--primary" type="submit">
        Save image order
      </button>
    </form>
  );
}

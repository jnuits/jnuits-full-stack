"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import type { HomepageSliderImage } from "@/lib/content/public-content";

type SliderServerAction = (formData: FormData) => void | Promise<void>;

type DeleteConfirmButtonProps = {
  deleteAction: SliderServerAction;
  imageId: string;
};

type CurrentSliderImagesFormProps = {
  count: number;
  deleteAction: SliderServerAction;
  images: HomepageSliderImage[];
  saveAction: SliderServerAction;
};

export function DeleteConfirmButton({
  deleteAction,
  imageId,
}: DeleteConfirmButtonProps) {
  const [state, setState] = useState<"idle" | "confirming">("idle");
  const containerRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<number | null>(null);

  function resetIfFocusLeaves() {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
    }

    blurTimeoutRef.current = window.setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setState("idle");
      }
    }, 200);
  }

  if (state === "idle") {
    return (
      <button
        className="admin-slider-delete-button"
        onClick={() => setState("confirming")}
        type="button"
      >
        Delete
      </button>
    );
  }

  return (
    <div
      className="admin-slider-delete-confirm"
      onBlur={resetIfFocusLeaves}
      ref={containerRef}
    >
      <p>Remove this image?</p>
      <div className="admin-slider-delete-confirm__actions">
        <form action={deleteAction}>
          <input name="imageId" type="hidden" value={imageId} />
          <button className="admin-slider-delete-confirm__yes" type="submit">
            Yes, remove
          </button>
        </form>
        <button
          className="admin-slider-delete-confirm__cancel"
          onClick={() => setState("idle")}
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function CurrentSliderImagesForm({
  count,
  deleteAction,
  images,
  saveAction,
}: CurrentSliderImagesFormProps) {
  const formId = "slider-save-form";
  const [saving, setSaving] = useState(false);
  const [dirtyImageIds, setDirtyImageIds] = useState<Set<string>>(
    () => new Set()
  );
  const [orders, setOrders] = useState<Record<string, string>>(() =>
    Object.fromEntries(images.map((image, index) => [image.id, String(index + 1)]))
  );

  const duplicateOrders = useMemo(() => {
    const seen = new Map<string, number>();

    Object.values(orders).forEach((order) => {
      const normalized = order.trim();

      if (!normalized) {
        return;
      }

      seen.set(normalized, (seen.get(normalized) || 0) + 1);
    });

    return new Set(
      Array.from(seen.entries())
        .filter(([, duplicates]) => duplicates > 1)
        .map(([order]) => order)
    );
  }, [orders]);

  const progressPercent = Math.min(100, Math.round((count / 15) * 100));
  const needsMore = Math.max(0, 5 - count);

  return (
    <div className="mt-5">
      <div className="admin-slider-save-row admin-slider-save-row--top">
        <SaveSliderButton formId={formId} saving={saving} />
      </div>

      <div className="admin-slider-counter">
        <div className="admin-slider-counter__meter">
          <div className="admin-slider-track" aria-hidden="true">
            <span
              className="admin-slider-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span>{count} of 15 image slots used</span>
        </div>
        {count < 5 ? (
          <span className="admin-slider-counter__badge admin-slider-counter__badge--warning">
            Add {needsMore} more (minimum 5)
          </span>
        ) : count === 15 ? (
          <span className="admin-slider-counter__badge admin-slider-counter__badge--info">
            Maximum reached - remove an image to add more
          </span>
        ) : null}
      </div>

      <form action={saveAction} id={formId} onSubmit={() => setSaving(true)} />

      <div className="admin-slider-card-list">
        {images.map((image, index) => {
          const order = orders[image.id] ?? String(index + 1);
          const hasDuplicateOrder =
            order.trim() !== "" && duplicateOrders.has(order.trim());
          const isDirty = dirtyImageIds.has(image.id);

          return (
            <article
              className={`admin-slider-card${isDirty ? " admin-slider-card--dirty" : ""}`}
              key={image.id}
            >
              <input form={formId} name="id" type="hidden" value={image.id} />
              <input
                form={formId}
                name="imageUrl"
                type="hidden"
                value={image.imageUrl}
              />

              <div className="admin-slider-card__header">
                <SliderImageThumbnail alt={image.title} src={image.imageUrl} />

                <label className="admin-slider-field-label admin-slider-order-field">
                  Display order
                  <input
                    aria-label={`Display order for ${image.title}`}
                    form={formId}
                    min={1}
                    name="sortOrder"
                    onChange={(event) => {
                      setOrders((current) => ({
                        ...current,
                        [image.id]: event.target.value,
                      }));
                      markDirty(image.id);
                    }}
                    type="number"
                    value={order}
                  />
                  {hasDuplicateOrder ? (
                    <span className="admin-slider-field-warning">
                      Duplicate order - each image needs a unique number.
                    </span>
                  ) : null}
                </label>

                <label className="admin-slider-field-label admin-slider-title-field">
                  Title
                  <input
                    defaultValue={image.title}
                    form={formId}
                    maxLength={80}
                    name="title"
                    onChange={() => markDirty(image.id)}
                    required
                  />
                </label>

                <DeleteConfirmButton
                  deleteAction={deleteAction}
                  imageId={image.id}
                />
              </div>

              <label className="admin-slider-field-label">
                Caption
                <input
                  defaultValue={image.caption}
                  form={formId}
                  maxLength={160}
                  name="caption"
                  onChange={() => markDirty(image.id)}
                />
              </label>

              <label className="admin-slider-field-label">
                Link
                <input
                  defaultValue={image.link || ""}
                  form={formId}
                  name="link"
                  onChange={() => markDirty(image.id)}
                  placeholder="/events or https://..."
                />
              </label>
            </article>
          );
        })}
      </div>

      <div className="admin-slider-save-row">
        <SaveSliderButton formId={formId} saving={saving} />
      </div>
    </div>
  );

  function markDirty(imageId: string) {
    setDirtyImageIds((current) => {
      if (current.has(imageId)) {
        return current;
      }

      const next = new Set(current);

      next.add(imageId);
      return next;
    });
  }
}

function SaveSliderButton({
  formId,
  saving,
}: {
  formId: string;
  saving: boolean;
}) {
  return (
    <button
      className="admin-btn admin-btn--primary"
      disabled={saving}
      form={formId}
      type="submit"
    >
      {saving ? "Saving…" : "Save slider images"}
    </button>
  );
}

function SliderImageThumbnail({ alt, src }: { alt: string; src: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="admin-slider-thumbnail admin-slider-thumbnail--missing">
        <ImageIcon aria-hidden="true" size={20} />
      </div>
    );
  }

  return (
    <div className="admin-slider-thumbnail">
      <Image
        alt={alt}
        height={56}
        onError={() => setFailed(true)}
        src={src}
        unoptimized
        width={80}
      />
    </div>
  );
}

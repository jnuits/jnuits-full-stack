import Image from "next/image";
import { cookies } from "next/headers";

import {
  addSliderImage,
  deleteSliderImage,
  saveSliderImages,
} from "@/app/admin/content/slider/actions";
import {
  ADMIN_FLASH_COOKIE_NAME,
  parseAdminFlash,
} from "@/lib/admin/flash";
import {
  homepageContent,
  type HomepageSliderImage,
} from "@/lib/content/public-content";
import type { Json } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Homepage Slider Images — Admin | JnUITS" };

function asRecord(value: Json | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

function asSliderImages(value: Json | undefined) {
  if (!Array.isArray(value)) {
    return homepageContent.sliderImages;
  }

  const images = value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const record = entry as Record<string, Json | undefined>;
      const id = typeof record.id === "string" ? record.id.trim() : "";
      const imageUrl =
        typeof record.imageUrl === "string" ? record.imageUrl.trim() : "";
      const title = typeof record.title === "string" ? record.title.trim() : "";
      const caption =
        typeof record.caption === "string" ? record.caption.trim() : "";
      const link = typeof record.link === "string" ? record.link.trim() : "";

      if (!id || !imageUrl || !title) {
        return null;
      }

      return {
        id,
        imageUrl,
        title,
        caption,
        link: link || null,
      };
    })
    .filter((entry): entry is HomepageSliderImage => Boolean(entry));

  return images.length > 0 ? images : homepageContent.sliderImages;
}

async function getSliderImages() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("content_pages")
    .select("body")
    .eq("slug", "home")
    .maybeSingle();

  return asSliderImages(asRecord(data?.body as Json | null | undefined).sliderImages);
}

export default async function AdminSliderImagesPage() {
  const [images, cookieStore] = await Promise.all([getSliderImages(), cookies()]);
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const count = images.length;
  const atMaximum = count >= 15;
  const progressPercent = Math.min(100, Math.round((count / 15) * 100));

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Content</p>
          <h1 className="admin-page-header__title">Homepage Slider Images</h1>
          <p className="admin-page-header__desc">
            Add between 5 and 15 images. The homepage displays 5 randomly selected images per visit.
          </p>
        </div>
        <span className={`abadge ${count < 5 ? "abadge--draft" : "abadge--published"}`}>
          {count} of 15 images
        </span>
      </div>

      {flash && (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="admin-section-label">Operator feedback</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">
            {flash.title}
          </h2>
          <p className="mt-1 text-sm leading-7">{flash.message}</p>
        </section>
      )}

      {count < 5 ? (
        <section className="flash-panel" data-tone="error">
          <p className="admin-section-label">Slider warning</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">
            Add at least 5 images for the slider to work correctly.
          </h2>
        </section>
      ) : null}

      <section className="admin-review-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="admin-section-label">Current images</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Reorder with the sort field, then save the slider image list.
            </p>
          </div>
          <span className="abadge abadge--active">{count} of 15 images</span>
        </div>
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--color-border-tertiary)]"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-[var(--color-primary)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <form action={saveSliderImages} className="mt-6 grid gap-4">
          {images.map((image, index) => (
            <article className="admin-card-row items-start" key={image.id}>
              <div className="relative h-10 w-[60px] shrink-0 overflow-hidden rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]">
                <Image
                  alt={image.title}
                  className="object-cover"
                  fill
                  sizes="60px"
                  src={image.imageUrl}
                  unoptimized
                />
              </div>
              <input name="id" type="hidden" value={image.id} />
              <input name="imageUrl" type="hidden" value={image.imageUrl} />
              <div className="admin-card-row__body grid gap-3">
                <div className="grid gap-3 lg:grid-cols-[0.35fr_1fr]">
                  <label className="input-label">
                    Drag handle / order
                    <input
                      aria-label={`Sort order for ${image.title}`}
                      defaultValue={index + 1}
                      min={1}
                      name="sortOrder"
                      type="number"
                    />
                  </label>
                  <label className="input-label">
                    Title
                    <input
                      defaultValue={image.title}
                      maxLength={80}
                      name="title"
                      required
                    />
                  </label>
                </div>
                <label className="input-label">
                  Caption
                  <input
                    defaultValue={image.caption}
                    maxLength={160}
                    name="caption"
                  />
                </label>
                <label className="input-label">
                  Link
                  <input
                    defaultValue={image.link || ""}
                    name="link"
                    placeholder="/events or https://..."
                  />
                </label>
              </div>
              <div className="admin-card-row__actions">
                <details className="text-right">
                  <summary className="admin-btn admin-btn--ghost cursor-pointer">
                    Delete
                  </summary>
                  <button
                    className="admin-btn admin-btn--danger mt-2"
                    formAction={deleteSliderImage}
                    name="imageId"
                    type="submit"
                    value={image.id}
                  >
                    Remove this image?
                  </button>
                </details>
              </div>
            </article>
          ))}

          <div className="flex flex-wrap gap-3">
            <button className="admin-btn admin-btn--primary" type="submit">
              Save slider images
            </button>
          </div>
        </form>
      </section>

      <section className="admin-review-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="admin-section-label">Add new image</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Upload a new image, or provide an existing image URL if the asset is already hosted.
            </p>
          </div>
          {atMaximum ? (
            <span className="abadge abadge--draft">Maximum 15 images reached</span>
          ) : null}
        </div>

        <form
          action={addSliderImage}
          className="mt-6 grid gap-4"
          encType="multipart/form-data"
        >
          <label className="input-label">
            Image upload
            <input accept="image/*" disabled={atMaximum} name="image" type="file" />
          </label>
          <label className="input-label">
            Existing image URL
            <input
              disabled={atMaximum}
              name="imageUrl"
              placeholder="https://res.cloudinary.com/..."
              type="url"
            />
          </label>
          <label className="input-label">
            Title
            <input disabled={atMaximum} maxLength={80} name="title" required />
          </label>
          <label className="input-label">
            Caption
            <input disabled={atMaximum} maxLength={160} name="caption" />
          </label>
          <label className="input-label">
            Link
            <input
              disabled={atMaximum}
              name="link"
              placeholder="/events/some-event"
            />
          </label>
          <div>
            <button
              className="admin-btn admin-btn--primary"
              disabled={atMaximum}
              type="submit"
            >
              Add image
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

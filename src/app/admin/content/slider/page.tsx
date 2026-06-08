import { cookies } from "next/headers";

import {
  addSliderImage,
  deleteSliderImage,
  saveSliderImages,
} from "@/app/admin/content/slider/actions";
import { AddImageForm } from "@/app/admin/content/slider/AddImageForm";
import { CurrentSliderImagesForm } from "@/app/admin/content/slider/DeleteConfirmButton";
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
        <section
          className="flash-panel admin-slider-flash-auto"
          data-tone={flash.tone}
        >
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
              Set the display order for each image, then click Save.
            </p>
          </div>
          <span className="abadge abadge--active">{count} of 15 images</span>
        </div>

        <CurrentSliderImagesForm
          count={count}
          deleteAction={deleteSliderImage}
          images={images}
          saveAction={saveSliderImages}
        />
      </section>

      <hr className="admin-slider-section-rule" />

      <section className="admin-slider-add-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="admin-slider-add-heading">Add new image</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Upload a new image, or provide an existing image URL if the asset is already hosted.
            </p>
          </div>
          {atMaximum ? (
            <span className="abadge abadge--draft">Maximum 15 images reached</span>
          ) : null}
        </div>

        <AddImageForm addAction={addSliderImage} disabled={atMaximum} />
      </section>
    </div>
  );
}

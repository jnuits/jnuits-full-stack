"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { setAdminFlash } from "@/lib/admin/flash";
import { requireAdminUser } from "@/lib/auth/session";
import {
  ensureSliderImageInDefaultFolder,
  uploadSliderImageToCloudinary,
} from "@/lib/cloudinary/slider";
import { homepageContent, type HomepageSliderImage } from "@/lib/content/public-content";
import type { Json } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";

const sliderItemSchema = z.object({
  caption: z.string().trim().max(160).optional().default(""),
  id: z.string().trim().min(1).max(120),
  imageUrl: z.string().trim().min(1).max(1000),
  link: z.string().trim().max(1000).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).max(999).default(100),
  title: z.string().trim().min(1).max(80),
});

const newSliderImageSchema = z.object({
  caption: z.string().trim().max(160).optional().default(""),
  imageUrl: z.string().trim().max(1000).optional().default(""),
  link: z.string().trim().max(1000).optional().default(""),
  title: z.string().trim().min(1, "Title is required.").max(80),
});

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

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
      const parsed = sliderItemSchema.safeParse({
        caption: typeof record.caption === "string" ? record.caption : "",
        id: typeof record.id === "string" ? record.id : "",
        imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : "",
        link: typeof record.link === "string" ? record.link : "",
        sortOrder: 100,
        title: typeof record.title === "string" ? record.title : "",
      });

      if (!parsed.success) {
        return null;
      }

      return {
        id: parsed.data.id,
        imageUrl: parsed.data.imageUrl,
        title: parsed.data.title,
        caption: parsed.data.caption,
        link: parsed.data.link || null,
      };
    })
    .filter((entry): entry is HomepageSliderImage => Boolean(entry));

  return images.length > 0 ? images : homepageContent.sliderImages;
}

async function readHomeBody() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("content_pages")
    .select("body")
    .eq("slug", "home")
    .maybeSingle();

  return asRecord(data?.body as Json | null | undefined);
}

async function saveHomeBody(body: Record<string, Json | undefined>, actorUserId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("content_pages").upsert(
    {
      body: body as Json,
      created_by_user_id: actorUserId,
      eyebrow: homepageContent.hero.eyebrow,
      slug: "home",
      status: "published",
      summary: homepageContent.hero.subheading,
      title: homepageContent.hero.heading,
    },
    { onConflict: "slug" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function addSliderImage(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const body = await readHomeBody();
  const existing = asSliderImages(body.sliderImages);

  if (existing.length >= 15) {
    await setAdminFlash({
      tone: "error",
      title: "Maximum slider images reached",
      message: "Remove an image before adding another one. The slider supports 15 images maximum.",
    });
    redirect("/admin/content/slider");
  }

  const parsed = newSliderImageSchema.safeParse({
    caption: asString(formData.get("caption")),
    imageUrl:
      asString(formData.get("existingImageUrl")) ||
      asString(formData.get("imageUrl")),
    link: asString(formData.get("link")),
    title: asString(formData.get("title")),
  });

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Slider image not added",
      message: parsed.error.issues[0]?.message || "Title is required.",
    });
    redirect("/admin/content/slider");
  }

  try {
    const file = formData.get("imageUpload") || formData.get("image");
    const imageUrl =
      file instanceof File && file.size > 0
        ? (await uploadSliderImageToCloudinary(file)).url
        : parsed.data.imageUrl
          ? (await ensureSliderImageInDefaultFolder(
              parsed.data.imageUrl,
              parsed.data.title
            )).url
          : "";

    if (!imageUrl) {
      throw new Error("Upload an image or provide an existing image URL.");
    }

    const nextImages: HomepageSliderImage[] = [
      ...existing,
      {
        id: `${slugify(parsed.data.title) || "slider-image"}-${Date.now()}`,
        imageUrl,
        title: parsed.data.title,
        caption: parsed.data.caption,
        link: parsed.data.link || null,
      },
    ];

    await saveHomeBody({ ...body, sliderImages: nextImages as unknown as Json }, actorUserId);
    revalidatePath("/");
    revalidatePath("/admin/content");
    revalidatePath("/admin/content/slider");
    await setAdminFlash({
      tone: "success",
      title: "Slider image added",
      message: `${nextImages.length} of 15 homepage slider images are now configured.`,
    });
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Slider image not added",
      message:
        error instanceof Error
          ? error.message
          : "The slider image could not be added.",
    });
  }

  redirect("/admin/content/slider");
}

export async function saveSliderImages(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const ids = formData.getAll("id");
  const imageUrls = formData.getAll("imageUrl");
  const titles = formData.getAll("title");
  const captions = formData.getAll("caption");
  const links = formData.getAll("link");
  const sortOrders = formData.getAll("sortOrder");

  const parsedImages = ids.map((id, index) =>
    sliderItemSchema.parse({
      caption: asString(captions[index] || null),
      id: asString(id),
      imageUrl: asString(imageUrls[index] || null),
      link: asString(links[index] || null),
      sortOrder: asString(sortOrders[index] || null) || index,
      title: asString(titles[index] || null),
    })
  );

  const sortedImages = parsedImages
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, 15);

  try {
    const nextImages: HomepageSliderImage[] = [];

    for (const image of sortedImages) {
      const storedImage = await ensureSliderImageInDefaultFolder(
        image.imageUrl,
        image.title
      );

      nextImages.push({
        id: image.id,
        imageUrl: storedImage.url,
        title: image.title,
        caption: image.caption,
        link: image.link || null,
      });
    }

    const body = await readHomeBody();
    await saveHomeBody({ ...body, sliderImages: nextImages as unknown as Json }, actorUserId);
    revalidatePath("/");
    revalidatePath("/admin/content");
    revalidatePath("/admin/content/slider");
    await setAdminFlash({
      tone: "success",
      title: "Slider images saved successfully.",
      message:
        nextImages.length < 5
          ? "Saved, but add at least 5 images before relying on the public slider."
          : `${nextImages.length} of 15 homepage slider images are configured.`,
    });
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Could not save slider images. Please try again.",
      message:
        error instanceof Error
          ? error.message
          : "The homepage slider images could not be saved.",
    });
  }

  redirect("/admin/content/slider");
}

export async function deleteSliderImage(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const imageId = asString(formData.get("imageId"));
  const body = await readHomeBody();
  const nextImages = asSliderImages(body.sliderImages).filter(
    (image) => image.id !== imageId
  );

  try {
    await saveHomeBody({ ...body, sliderImages: nextImages as unknown as Json }, actorUserId);
    revalidatePath("/");
    revalidatePath("/admin/content");
    revalidatePath("/admin/content/slider");
    await setAdminFlash({
      tone: "success",
      title: "Slider image removed",
      message:
        nextImages.length < 5
          ? "Image removed. Add at least 5 images for the slider to work correctly."
          : `${nextImages.length} of 15 homepage slider images remain configured.`,
    });
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Slider image not removed",
      message:
        error instanceof Error
          ? error.message
          : "The homepage slider image could not be removed.",
    });
  }

  redirect("/admin/content/slider");
}

"use client";

import { useRouter } from "next/navigation";
import { FileImage, Plus, UploadCloud, X } from "lucide-react";
import { startTransition, useState } from "react";
import { CLOUDINARY_PROJECT_ROOT_FOLDER } from "@/lib/branding";

type GalleryCategory = {
  label: string;
  value: string;
};

type GalleryAlbumCreateFlowProps = {
  categories: GalleryCategory[];
  cloudName: string;
  cloudinaryConfigured: boolean;
  defaultMonth: number;
  defaultYear: number;
  disabled?: boolean;
};

type CreateFlowState = {
  error: string | null;
  message: string | null;
  pending: boolean;
  progress: string | null;
};

type UploadedAsset = {
  bytes?: number;
  format?: string;
  height?: number;
  public_id?: string;
  resource_type?: string;
  secure_url?: string;
  width?: number;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 140);
}

function padMonth(value: string | number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12
    ? String(parsed).padStart(2, "0")
    : "MM";
}

function buildCloudinaryFolder(options: {
  month: string;
  slug: string;
  year: string;
}) {
  const year = options.year.trim() || "YYYY";
  const month = padMonth(options.month);
  const slug = options.slug.trim() || "album-slug";

  return `${CLOUDINARY_PROJECT_ROOT_FOLDER}/gallery/${year}/${month}/${slug}`;
}

function filenameLabel(file: File) {
  return file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
}

export function GalleryAlbumCreateFlow({
  categories,
  cloudName,
  cloudinaryConfigured,
  defaultMonth,
  defaultYear,
  disabled = false,
}: GalleryAlbumCreateFlowProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [eventName, setEventName] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [eventNameTouched, setEventNameTouched] = useState(false);
  const [folderTouched, setFolderTouched] = useState(false);
  const [year, setYear] = useState(String(defaultYear));
  const [month, setMonth] = useState(String(defaultMonth));
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [category, setCategory] = useState("other-real-event");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("published");
  const [featured, setFeatured] = useState("false");
  const [folder, setFolder] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<CreateFlowState>({
    error: null,
    message: null,
    pending: false,
    progress: null,
  });
  const derivedFolder = buildCloudinaryFolder({ month, slug, year });
  const cloudinaryFolder = folderTouched ? folder : derivedFolder;
  const metadataReady = Boolean(
    title.trim() && slug.trim() && year.trim() && month.trim() && cloudinaryFolder.trim()
  );
  const canSelectFiles =
    !disabled && !state.pending && cloudinaryConfigured && metadataReady;
  const canSubmit = !disabled && !state.pending && metadataReady;

  function handleTitleChange(value: string) {
    const nextSlug = slugify(value);

    setTitle(value);

    if (!slugTouched) {
      setSlug(nextSlug);
    }

    if (!eventNameTouched) {
      setEventName(value);
    }
  }

  function appendFiles(fileList: FileList | null) {
    if (!fileList || !canSelectFiles) {
      return;
    }

    setFiles((current) => [...current, ...Array.from(fileList)]);
  }

  async function uploadFiles(albumId: string, uploadFolder: string) {
    if (!files.length) {
      return;
    }

    const signResponse = await fetch("/api/admin/cloudinary/sign", {
      body: JSON.stringify({
        folder: uploadFolder,
        resourceType: "image",
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const signBody = (await signResponse.json().catch(() => null)) as
      | {
          apiKey?: string;
          folder?: string;
          message?: string;
          signature?: string;
          timestamp?: number;
          uploadPreset?: string | null;
          uploadUrl?: string;
        }
      | null;

    if (
      !signResponse.ok ||
      !signBody?.apiKey ||
      !signBody.signature ||
      !signBody.timestamp ||
      !signBody.uploadUrl
    ) {
      throw new Error(signBody?.message || "Unable to sign Cloudinary uploads.");
    }

    const uploadedAssets = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setState((current) => ({
        ...current,
        progress: `Uploading ${index + 1} of ${files.length}: ${file.name}`,
      }));

      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("api_key", signBody.apiKey);
      uploadFormData.append("timestamp", String(signBody.timestamp));
      uploadFormData.append("signature", signBody.signature);
      uploadFormData.append("folder", signBody.folder || uploadFolder);
      uploadFormData.append("use_filename", "true");
      uploadFormData.append("unique_filename", "true");

      if (signBody.uploadPreset) {
        uploadFormData.append("upload_preset", signBody.uploadPreset);
      }

      const uploadResponse = await fetch(signBody.uploadUrl, {
        body: uploadFormData,
        method: "POST",
      });
      const uploadBody = (await uploadResponse.json().catch(() => null)) as
        | (UploadedAsset & { message?: string })
        | null;

      if (!uploadResponse.ok || !uploadBody?.public_id || !uploadBody.secure_url) {
        throw new Error(uploadBody?.message || `Cloudinary upload failed for ${file.name}.`);
      }

      uploadedAssets.push({
        altText: filenameLabel(file),
        bytes: uploadBody.bytes || null,
        format: uploadBody.format || null,
        height: uploadBody.height || null,
        isPublic: true,
        mediaKind: "image",
        metadata: {
          folder: signBody.folder || uploadFolder,
          originalFileName: file.name,
          source: "admin-create-album-upload-flow",
        },
        publicId: uploadBody.public_id,
        resourceType: uploadBody.resource_type || "image",
        secureUrl: uploadBody.secure_url,
        thumbnailUrl: uploadBody.secure_url,
        title: filenameLabel(file),
        width: uploadBody.width || null,
      });
    }

    setState((current) => ({
      ...current,
      progress: "Registering uploaded photos in Supabase metadata.",
    }));

    const registerResponse = await fetch(`/api/admin/gallery/albums/${albumId}/media`, {
      body: JSON.stringify({ assets: uploadedAssets }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const registerBody = (await registerResponse.json().catch(() => null)) as
      | { message?: string }
      | null;

    if (!registerResponse.ok) {
      throw new Error(
        registerBody?.message || "Uploaded files could not be attached to this album."
      );
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!metadataReady) {
      setState({
        error: "Title, year, month, slug, and folder are required before upload.",
        message: null,
        pending: false,
        progress: null,
      });
      return;
    }

    if (files.length && !cloudinaryConfigured) {
      setState({
        error: "Cloudinary is not configured, so files cannot be uploaded.",
        message: null,
        pending: false,
        progress: null,
      });
      return;
    }

    setState({
      error: null,
      message: null,
      pending: true,
      progress: "Creating album metadata in Supabase.",
    });

    try {
      const albumResponse = await fetch("/api/admin/gallery/albums", {
        body: JSON.stringify({
          category,
          cloudinaryFolder,
          description,
          endsOn,
          eventName: eventName || title,
          featured: featured === "true",
          month: Number(month),
          slug,
          startsOn,
          status,
          title,
          year: Number(year),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const albumBody = (await albumResponse.json().catch(() => null)) as
        | {
            data?: { id?: string; slug?: string };
            message?: string;
          }
        | null;

      if (!albumResponse.ok || !albumBody?.data?.id) {
        throw new Error(albumBody?.message || "Gallery album could not be created.");
      }

      await uploadFiles(albumBody.data.id, cloudinaryFolder);

      setState({
        error: null,
        message: files.length
          ? "Album created and photos uploaded."
          : "Album created. You can add photos from the Manage Media page.",
        pending: false,
        progress: null,
      });

      startTransition(() => {
        router.push(`/admin/content/gallery/${albumBody.data?.id}`);
        router.refresh();
      });
    } catch (error) {
      setState({
        error:
          error instanceof Error
            ? error.message
            : "The create-and-upload flow could not be completed.",
        message: null,
        pending: false,
        progress: null,
      });
    }
  }

  return (
    <form className="admin-album-create-flow" onSubmit={handleSubmit}>
      <div>
        <p className="admin-section-label">Create album</p>
        <h2 className="admin-card-row__title">Create Album & Upload</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
          Fill the album title once. Slug, event name, and Cloudinary folder are
          generated automatically, then photos upload into the derived folder.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="input-label sm:col-span-2">
          Album title
          <input
            disabled={disabled || state.pending}
            name="title"
            onChange={(event) => handleTitleChange(event.target.value)}
            placeholder="Spring Fest 2026"
            required
            value={title}
          />
        </label>
        <label className="input-label">
          Slug
          <input
            disabled={disabled || state.pending}
            name="slug"
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
            placeholder="spring-fest-2026"
            required
            value={slug}
          />
        </label>
        <label className="input-label">
          Event name
          <input
            disabled={disabled || state.pending}
            name="eventName"
            onChange={(event) => {
              setEventNameTouched(true);
              setEventName(event.target.value);
            }}
            placeholder="Spring Fest 2026"
            value={eventName}
          />
        </label>
        <label className="input-label">
          Year
          <input
            disabled={disabled || state.pending}
            min="2015"
            name="year"
            onChange={(event) => setYear(event.target.value)}
            required
            type="number"
            value={year}
          />
        </label>
        <label className="input-label">
          Month
          <input
            disabled={disabled || state.pending}
            max="12"
            min="1"
            name="month"
            onChange={(event) => setMonth(event.target.value)}
            required
            type="number"
            value={month}
          />
        </label>
        <label className="input-label">
          Start date
          <input
            disabled={disabled || state.pending}
            name="startsOn"
            onChange={(event) => setStartsOn(event.target.value)}
            type="date"
            value={startsOn}
          />
        </label>
        <label className="input-label">
          End date
          <input
            disabled={disabled || state.pending}
            name="endsOn"
            onChange={(event) => setEndsOn(event.target.value)}
            type="date"
            value={endsOn}
          />
        </label>
        <label className="input-label">
          Category
          <select
            disabled={disabled || state.pending}
            name="category"
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="input-label">
          Status
          <select
            disabled={disabled || state.pending}
            name="status"
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="input-label">
          Featured
          <select
            disabled={disabled || state.pending}
            name="featured"
            onChange={(event) => setFeatured(event.target.value)}
            value={featured}
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </label>
        <label className="input-label sm:col-span-2">
          Album description
          <textarea
            disabled={disabled || state.pending}
            name="description"
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Short public album description"
            rows={3}
            value={description}
          />
        </label>
        <label className="input-label sm:col-span-2">
          Cloudinary folder
          <input
            disabled={disabled || state.pending}
            name="cloudinaryFolder"
            onChange={(event) => {
              setFolderTouched(true);
              setFolder(event.target.value);
            }}
            value={cloudinaryFolder}
          />
        </label>
      </div>

      <label
        className="admin-create-upload-zone"
        data-disabled={!canSelectFiles ? "true" : undefined}
        onDragOver={(event) => {
          if (canSelectFiles) {
            event.preventDefault();
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          appendFiles(event.dataTransfer.files);
        }}
      >
        <input
          accept="image/*"
          className="sr-only"
          disabled={!canSelectFiles}
          multiple
          onChange={(event) => appendFiles(event.target.files)}
          type="file"
        />
        <UploadCloud size={22} />
        <span>
          <span className="block font-semibold">
            {metadataReady
              ? "Drop gallery photos here or click to choose"
              : "Complete title, year, and month before upload"}
          </span>
          <span className="mt-1 block text-sm text-[var(--muted-foreground)]">
            {cloudinaryConfigured
              ? `Destination: ${cloudinaryFolder}`
              : "Cloudinary is not configured in this environment."}
          </span>
        </span>
      </label>

      {files.length ? (
        <div className="admin-create-file-list">
          {files.slice(0, 8).map((file) => (
            <span className="status-pill" key={`${file.name}-${file.size}`}>
              <FileImage size={13} />
              {file.name}
            </span>
          ))}
          {files.length > 8 ? (
            <span className="status-pill">+{files.length - 8} more</span>
          ) : null}
          <button
            className="admin-btn admin-btn--ghost"
            disabled={state.pending}
            onClick={() => setFiles([])}
            type="button"
          >
            <X size={14} />
            Clear files
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button className="admin-btn admin-btn--primary" disabled={!canSubmit} type="submit">
          <Plus size={15} />
          {state.pending
            ? "Working..."
            : files.length
              ? `Create album & upload ${files.length} photo${files.length === 1 ? "" : "s"}`
              : "Create album"}
        </button>
        {cloudName ? <span className="abadge abadge--info">Cloud {cloudName}</span> : null}
      </div>

      {state.progress ? (
        <p className="portal-message" aria-live="polite">
          {state.progress}
        </p>
      ) : null}
      {state.message ? (
        <p className="portal-message portal-message--success" aria-live="polite">
          {state.message}
        </p>
      ) : null}
      {state.error ? (
        <p className="portal-message portal-message--error" aria-live="polite">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

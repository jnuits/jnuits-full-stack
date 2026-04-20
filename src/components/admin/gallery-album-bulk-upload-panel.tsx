"use client";

import { useRouter } from "next/navigation";
import { startTransition, useDeferredValue, useState } from "react";

type GalleryAlbumBulkUploadPanelProps = {
  albumId: string;
  cloudName: string;
  configured: boolean;
  defaultFolder: string;
};

type UploadState = {
  error: string | null;
  message: string | null;
  pending: boolean;
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

export function GalleryAlbumBulkUploadPanel({
  albumId,
  cloudName,
  configured,
  defaultFolder,
}: GalleryAlbumBulkUploadPanelProps) {
  const router = useRouter();
  const [folder, setFolder] = useState(defaultFolder);
  const deferredFolder = useDeferredValue(folder);
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<UploadState>({
    error: null,
    message: null,
    pending: false,
  });

  function appendFiles(fileList: FileList | null) {
    if (!fileList) {
      return;
    }

    setFiles((current) => [...current, ...Array.from(fileList)]);
  }

  async function handleUpload() {
    if (!files.length) {
      setState({
        error: "Choose one or more images before uploading.",
        message: null,
        pending: false,
      });
      return;
    }

    setState({ error: null, message: null, pending: true });

    try {
      const signResponse = await fetch("/api/admin/cloudinary/sign", {
        body: JSON.stringify({
          folder: deferredFolder,
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
            signature?: string;
            timestamp?: number;
            uploadPreset?: string | null;
            uploadUrl?: string;
            message?: string;
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

      for (const file of files) {
        const uploadFormData = new FormData();
        uploadFormData.append("file", file);
        uploadFormData.append("api_key", signBody.apiKey);
        uploadFormData.append("timestamp", String(signBody.timestamp));
        uploadFormData.append("signature", signBody.signature);
        uploadFormData.append("folder", signBody.folder || deferredFolder);
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
          altText: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
          bytes: uploadBody.bytes || null,
          format: uploadBody.format || null,
          height: uploadBody.height || null,
          isPublic: true,
          mediaKind: "image",
          metadata: {
            folder: signBody.folder || deferredFolder,
            originalFileName: file.name,
            source: "admin-gallery-bulk-upload",
          },
          publicId: uploadBody.public_id,
          resourceType: uploadBody.resource_type || "image",
          secureUrl: uploadBody.secure_url,
          thumbnailUrl: uploadBody.secure_url,
          title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
          width: uploadBody.width || null,
        });
      }

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

      setFiles([]);
      setState({
        error: null,
        message:
          registerBody?.message ||
          `${uploadedAssets.length} image(s) uploaded to Cloudinary and registered in Supabase metadata.`,
        pending: false,
      });
      router.refresh();
    } catch (error) {
      setState({
        error:
          error instanceof Error
            ? error.message
            : "Gallery bulk upload could not be completed.",
        message: null,
        pending: false,
      });
    }
  }

  if (!configured) {
    return (
      <div className="empty-state">
        Set Cloudinary environment variables before using album bulk upload.
      </div>
    );
  }

  return (
    <div className="admin-review-card grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="admin-section-label">Bulk upload</p>
          <h2 className="admin-card-row__title">
            Upload to Cloudinary and register metadata
          </h2>
        </div>
        <span className="abadge abadge--info">Cloud {cloudName}</span>
      </div>

      <label
        className="grid min-h-36 cursor-pointer place-items-center rounded-[1.25rem] border border-dashed border-[var(--line)] bg-[var(--background)] p-6 text-center transition hover:border-[var(--primary)]"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          appendFiles(event.dataTransfer.files);
        }}
      >
        <input
          accept="image/*"
          className="sr-only"
          multiple
          onChange={(event) => appendFiles(event.target.files)}
          type="file"
        />
        <span>
          <span className="block font-semibold">Drop images here or click to choose</span>
          <span className="mt-2 block text-sm text-[var(--muted-foreground)]">
            {files.length
              ? `${files.length} file(s) ready to upload`
              : "Files go to Cloudinary. Supabase stores only metadata and album links."}
          </span>
        </span>
      </label>

      {files.length ? (
        <div className="flex flex-wrap gap-2">
          {files.slice(0, 8).map((file) => (
            <span className="status-pill" key={`${file.name}-${file.size}`}>
              {file.name}
            </span>
          ))}
          {files.length > 8 ? <span className="status-pill">+{files.length - 8} more</span> : null}
        </div>
      ) : null}

      <label className="input-label">
        Cloudinary folder
        <input
          onChange={(event) => setFolder(event.target.value)}
          value={folder}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          className="admin-btn admin-btn--primary"
          disabled={state.pending}
          onClick={() =>
            startTransition(() => {
              void handleUpload();
            })
          }
          type="button"
        >
          {state.pending ? "Uploading..." : "Upload to Cloudinary"}
        </button>
        <button
          className="admin-btn admin-btn--ghost"
          disabled={state.pending || !files.length}
          onClick={() => setFiles([])}
          type="button"
        >
          Clear selection
        </button>
      </div>

      {state.message ? (
        <p className="portal-message portal-message--success">{state.message}</p>
      ) : null}
      {state.error ? (
        <p className="portal-message portal-message--error">{state.error}</p>
      ) : null}
    </div>
  );
}

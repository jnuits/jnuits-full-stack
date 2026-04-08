"use client";

import { useRouter } from "next/navigation";
import { startTransition, useDeferredValue, useState } from "react";

type CloudinaryUploadPanelProps = {
  cloudName: string;
  configured: boolean;
  defaultFolder: string;
};

type UploadState = {
  error: string | null;
  message: string | null;
  pending: boolean;
};

export function CloudinaryUploadPanel({
  cloudName,
  configured,
  defaultFolder,
}: CloudinaryUploadPanelProps) {
  const router = useRouter();
  const [state, setState] = useState<UploadState>({
    error: null,
    message: null,
    pending: false,
  });
  const [folder, setFolder] = useState(defaultFolder);
  const deferredFolder = useDeferredValue(folder);

  async function handleUpload(formData: FormData) {
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setState({
        error: "Choose an image or video before starting the Cloudinary upload.",
        message: null,
        pending: false,
      });
      return;
    }

    setState({
      error: null,
      message: null,
      pending: true,
    });

    const mediaKind = file.type.startsWith("video/") ? "video" : "image";

    try {
      const signResponse = await fetch("/api/admin/cloudinary/sign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folder: deferredFolder,
          resourceType: "auto",
        }),
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
        throw new Error(signBody?.message || "Unable to sign the Cloudinary upload.");
      }

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
        method: "POST",
        body: uploadFormData,
      });

      const uploadBody = (await uploadResponse.json().catch(() => null)) as
        | {
            bytes?: number;
            duration?: number;
            format?: string;
            height?: number;
            public_id?: string;
            resource_type?: string;
            secure_url?: string;
            width?: number;
            message?: string;
          }
        | null;

      if (!uploadResponse.ok || !uploadBody?.public_id || !uploadBody.secure_url) {
        throw new Error(uploadBody?.message || "Cloudinary upload failed.");
      }

      const registerResponse = await fetch("/api/admin/media-assets/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          altText: String(formData.get("altText") || "").trim() || undefined,
          bytes: typeof uploadBody.bytes === "number" ? uploadBody.bytes : null,
          durationSeconds:
            typeof uploadBody.duration === "number" ? uploadBody.duration : null,
          format: uploadBody.format || null,
          height: typeof uploadBody.height === "number" ? uploadBody.height : null,
          isPublic: String(formData.get("isPublic") || "true") === "true",
          mediaKind,
          metadata: {
            folder: signBody.folder || deferredFolder,
            source: "direct-upload",
          },
          publicId: uploadBody.public_id,
          resourceType: uploadBody.resource_type || mediaKind,
          secureUrl: uploadBody.secure_url,
          thumbnailUrl: uploadBody.secure_url,
          title: String(formData.get("title") || "").trim() || undefined,
          width: typeof uploadBody.width === "number" ? uploadBody.width : null,
        }),
      });

      const registerBody = (await registerResponse.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!registerResponse.ok) {
        throw new Error(
          registerBody?.message || "The Cloudinary asset could not be registered."
        );
      }

      setState({
        error: null,
        message:
          registerBody?.message ||
          "Cloudinary upload complete. The asset is now available in the admin registry.",
        pending: false,
      });
      router.refresh();
    } catch (error) {
      setState({
        error:
          error instanceof Error
            ? error.message
            : "The Cloudinary upload could not be completed.",
        message: null,
        pending: false,
      });
    }
  }

  return (
    <div className="section-band grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="eyebrow">Direct Cloudinary upload</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
            Upload photos and videos straight to Cloudinary
          </h2>
        </div>
        <span className="status-pill">
          {configured ? `Cloud ${cloudName}` : "Cloudinary env missing"}
        </span>
      </div>
      <p className="section-copy">
        Large gallery photos and videos bypass Supabase storage entirely. This
        uploader signs the request server-side, sends the file directly to
        Cloudinary, then registers only the metadata in Supabase.
      </p>

      {!configured ? (
        <div className="empty-state">
          Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
          `CLOUDINARY_API_SECRET` before using the direct upload flow.
        </div>
      ) : (
        <form
          action={(formData) => startTransition(() => void handleUpload(formData))}
          className="portal-form-grid"
        >
          <label className="input-label sm:col-span-2">
            File
            <input accept="image/*,video/*" name="file" type="file" />
          </label>
          <label className="input-label">
            Title
            <input name="title" placeholder="Gallery hero image" />
          </label>
          <label className="input-label">
            Visibility
            <select defaultValue="true" name="isPublic">
              <option value="true">Public</option>
              <option value="false">Internal only</option>
            </select>
          </label>
          <label className="input-label sm:col-span-2">
            Alt text
            <input name="altText" placeholder="Accessible description" />
          </label>
          <label className="input-label sm:col-span-2">
            Cloudinary folder
            <input
              name="folder"
              onChange={(event) => setFolder(event.target.value)}
              placeholder={defaultFolder}
              value={folder}
            />
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button className="primary-button" disabled={state.pending} type="submit">
              {state.pending ? "Uploading..." : "Upload to Cloudinary"}
            </button>
          </div>
        </form>
      )}

      {state.message ? (
        <p className="portal-message portal-message--success">{state.message}</p>
      ) : null}
      {state.error ? (
        <p className="portal-message portal-message--error">{state.error}</p>
      ) : null}
    </div>
  );
}

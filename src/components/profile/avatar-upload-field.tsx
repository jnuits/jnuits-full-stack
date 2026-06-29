"use client";

import { Camera, Info, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ProfileAvatar } from "@/components/profile/profile-avatar";

type AvatarTargetType = "admin_profile" | "member";

type AvatarUploadFieldProps = {
  canUpload: boolean;
  compact?: boolean;
  currentUrl?: null | string;
  showLegacyAvatar?: boolean;
  displayName: string;
  targetId: string;
  targetType: AvatarTargetType;
};

type UploadState = {
  error: null | string;
  message: null | string;
  pending: boolean;
};

type SignResponse = {
  apiKey?: string;
  invalidate?: boolean;
  overwrite?: boolean;
  publicId?: string;
  signature?: string;
  timestamp?: number;
  uploadPreset?: string;
  uploadUrl?: string;
  message?: string;
};

type CloudinaryUploadResponse = {
  bytes?: number;
  error?: { message?: string };
  format?: string;
  height?: number;
  message?: string;
  public_id?: string;
  secure_url?: string;
  width?: number;
};

const MAX_FILE_BYTES = 1_048_576;
const MIN_DIMENSION = 400;
const MAX_DIMENSION = 800;
const HELPER_TEXT = "JPG or PNG · 400–800px wide · 400–800px tall · max 1MB";

function getInitials(displayName: string) {
  return displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function getImageDimensions(file: File) {
  return new Promise<{ height: number; width: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const dimensions = {
        height: image.naturalHeight,
        width: image.naturalWidth,
      };
      URL.revokeObjectURL(objectUrl);
      resolve(dimensions);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected file is not a readable image."));
    };
    image.src = objectUrl;
  });
}

async function validateImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a supported image file.");
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Profile photo must be 1MB or smaller.");
  }

  const dimensions = await getImageDimensions(file);

  if (
    dimensions.width < MIN_DIMENSION ||
    dimensions.height < MIN_DIMENSION ||
    dimensions.width > MAX_DIMENSION ||
    dimensions.height > MAX_DIMENSION
  ) {
    throw new Error(
      "Profile photo must be between 400x400 and 800x800 pixels.",
    );
  }
}

async function parseJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

export function AvatarUploadField({
  canUpload,
  compact = false,
  currentUrl,
  displayName,
  showLegacyAvatar = true,
  targetId,
  targetType,
}: AvatarUploadFieldProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<UploadState>({
    error: null,
    message: null,
    pending: false,
  });
  const initials = getInitials(displayName);

  async function uploadAvatar(file: File) {
    setState({ error: null, message: null, pending: true });

    try {
      await validateImage(file);

      const signResponse = await fetch("/api/profile/avatar/sign", {
        body: JSON.stringify({ targetId, targetType }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const signBody = await parseJson<SignResponse>(signResponse);

      if (
        !signResponse.ok ||
        !signBody?.apiKey ||
        !signBody.publicId ||
        !signBody.signature ||
        !signBody.timestamp ||
        !signBody.uploadPreset ||
        !signBody.uploadUrl
      ) {
        throw new Error(
          signBody?.message || "Unable to sign profile photo upload.",
        );
      }

      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("api_key", signBody.apiKey);
      uploadFormData.append("timestamp", String(signBody.timestamp));
      uploadFormData.append("signature", signBody.signature);
      uploadFormData.append("public_id", signBody.publicId);
      uploadFormData.append("upload_preset", signBody.uploadPreset);
      uploadFormData.append("overwrite", "true");
      uploadFormData.append("invalidate", "true");

      const uploadResponse = await fetch(signBody.uploadUrl, {
        body: uploadFormData,
        method: "POST",
      });
      const uploadBody =
        await parseJson<CloudinaryUploadResponse>(uploadResponse);

      if (
        !uploadResponse.ok ||
        !uploadBody?.public_id ||
        !uploadBody.secure_url ||
        typeof uploadBody.width !== "number" ||
        typeof uploadBody.height !== "number" ||
        typeof uploadBody.bytes !== "number" ||
        !uploadBody.format
      ) {
        throw new Error(
          uploadBody?.error?.message ||
            uploadBody?.message ||
            "Cloudinary profile photo upload failed.",
        );
      }

      const completeResponse = await fetch("/api/profile/avatar/complete", {
        body: JSON.stringify({
          bytes: uploadBody.bytes,
          format: uploadBody.format,
          height: uploadBody.height,
          publicId: uploadBody.public_id,
          secureUrl: uploadBody.secure_url,
          targetId,
          targetType,
          width: uploadBody.width,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const completeBody = await parseJson<{ message?: string }>(
        completeResponse,
      );

      if (!completeResponse.ok) {
        throw new Error(
          completeBody?.message || "Profile photo metadata could not be saved.",
        );
      }

      setState({
        error: null,
        message: completeBody?.message || "Profile photo updated.",
        pending: false,
      });
      router.refresh();
    } catch (error) {
      setState({
        error:
          error instanceof Error
            ? error.message
            : "Profile photo upload could not be completed.",
        message: null,
        pending: false,
      });
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function handleSelect(fileList: FileList | null) {
    const file = fileList?.[0];

    if (!file) {
      return;
    }

    void uploadAvatar(file);
  }

  return (
    <div
      style={{
        display: "grid",
        gap: compact ? "0.45rem" : "0.65rem",
        maxWidth: compact ? "18rem" : undefined,
      }}
    >
      <div
        className="avatar-upload-row"
        style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "nowrap",
          gap: "0.65rem",
        }}
      >
        <ProfileAvatar
          name={displayName}
          src={currentUrl}
          size={compact ? "md" : "lg"}
        />
        {showLegacyAvatar ? (
          <div
            aria-hidden="true"
            className="portal-identity-banner__avatar"
            style={{
              backgroundImage: currentUrl ? `url("${currentUrl}")` : undefined,
              backgroundPosition: "center",
              backgroundSize: "cover",
              flex: "0 0 auto",
            }}
          >
            {currentUrl ? null : initials}
          </div>
        ) : null}
        {canUpload ? (
          <>
            <button
              aria-label="Upload profile photo"
              className="secondary-button"
              disabled={state.pending}
              onClick={() => inputRef.current?.click()}
              style={{
                minHeight: compact ? "2.45rem" : undefined,
                padding: compact ? "0.65rem 0.95rem" : undefined,
              }}
              type="button"
            >
              {state.pending ? <Loader2 size={15} /> : <Camera size={15} />}
              {state.pending ? "Uploading..." : "Upload photo"}
              <span className="avatar-upload-info">
                <Info aria-hidden="true" size={13} />
                <span role="tooltip">{HELPER_TEXT}</span>
              </span>
            </button>
            <input
              accept="image/*"
              disabled={state.pending}
              hidden
              onChange={(event) => handleSelect(event.target.files)}
              ref={inputRef}
              type="file"
            />
          </>
        ) : null}
      </div>
      {state.message ? (
        <p className="portal-message portal-message--success">
          {state.message}
        </p>
      ) : null}
      {state.error ? (
        <p className="portal-message portal-message--error">{state.error}</p>
      ) : null}
    </div>
  );
}

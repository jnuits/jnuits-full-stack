"use client";

import Image from "next/image";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { CloudinaryPicker } from "@/app/admin/content/slider/CloudinaryPicker";

type SliderServerAction = (formData: FormData) => void | Promise<void>;

type AddImageFormProps = {
  addAction: SliderServerAction;
  disabled?: boolean;
};

export function AddImageForm({
  addAction,
  disabled = false,
}: AddImageFormProps) {
  const [existingImageUrl, setExistingImageUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");

  function setPreview(nextUrl: string) {
    const trimmedUrl = nextUrl.trim();

    if (!trimmedUrl) {
      setPreviewUrl(null);
      setPreviewError("");
      return;
    }

    setPreviewError("");
    setPreviewUrl(trimmedUrl);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPreviewError("");
        setPreviewUrl(reader.result);
      }
    };
    reader.onerror = () => {
      setPreviewUrl(null);
      setPreviewError("Image could not be loaded from this file.");
    };

    reader.readAsDataURL(file);
  }

  return (
    <>
      <form action={addAction} className="admin-slider-add-form">
        <label className="input-label">
          Image upload
          <input
            accept="image/*"
            disabled={disabled}
            name="imageUpload"
            onChange={handleFileChange}
            type="file"
          />
        </label>

        <CloudinaryPicker
          disabled={disabled}
          onSelect={setPreview}
          onUrlBlur={setPreview}
          onValueChange={setExistingImageUrl}
          value={existingImageUrl}
        />

        {previewUrl ? (
          <div className="admin-slider-add-preview">
            <Image
              alt="Selected slider image preview"
              className="admin-slider-add-preview__image"
              height={675}
              onError={() => {
                setPreviewUrl(null);
                setPreviewError("Image could not be loaded from this URL.");
              }}
              src={previewUrl}
              unoptimized
              width={1200}
            />
            <span className="admin-slider-add-preview__label">Preview</span>
          </div>
        ) : null}

        {previewError ? (
          <p className="admin-slider-preview-error">{previewError}</p>
        ) : null}

        <label className="input-label admin-slider-add-label">
          <span>
            Title <span className="admin-slider-required">*</span>
          </span>
          <input disabled={disabled} maxLength={80} name="title" required />
        </label>

        <label className="input-label admin-slider-add-label">
          <span>
            Caption{" "}
            <span className="admin-slider-optional">(optional)</span>
          </span>
          <input disabled={disabled} maxLength={160} name="caption" />
        </label>

        <label className="input-label admin-slider-add-label">
          <span>
            Link <span className="admin-slider-optional">(optional)</span>
          </span>
          <input
            disabled={disabled}
            name="link"
            placeholder="/events/some-event"
          />
        </label>

        <div>
          <AddImageSubmitButton disabled={disabled} />
        </div>
      </form>

      <p className="admin-slider-required-note">
        <span className="admin-slider-required">*</span> Required
      </p>
    </>
  );
}

function AddImageSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="admin-btn admin-btn--primary"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? "Adding..." : "Add image"}
    </button>
  );
}

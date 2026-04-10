"use client";

import { Trash2 } from "lucide-react";

interface Props {
  formAction: (formData: FormData) => Promise<void>;
  certId: string; // DB UUID
  displayId: string; // certificate_id for confirmation message
}

export function DeleteCertButton({ formAction, certId, displayId }: Props) {
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={certId} />
      <button
        type="submit"
        className="ghost-button"
        style={{
          padding: "0.3rem 0.5rem",
          fontSize: "0.74rem",
          minHeight: "auto",
          borderRadius: "0.5rem",
          color: "var(--brand-rust)",
        }}
        title="Delete certificate"
        onClick={(e) => {
          if (!window.confirm(`Delete ${displayId}? This cannot be undone.`)) {
            e.preventDefault();
          }
        }}
      >
        <Trash2 size={11} />
      </button>
    </form>
  );
}

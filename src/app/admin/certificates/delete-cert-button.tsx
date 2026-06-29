"use client";

import { Trash2 } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";

interface Props {
  formAction: (formData: FormData) => Promise<void>;
  certId: string;
  displayId: string;
}

export function DeleteCertButton({ formAction, certId, displayId }: Props) {
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={certId} />
      <ConfirmSubmitButton
        className="ghost-button"
        confirmLabel="Delete certificate"
        description={`This permanently removes ${displayId} from the certificate registry.`}
        style={{
          padding: "0.3rem 0.5rem",
          fontSize: "0.74rem",
          minHeight: "auto",
          borderRadius: "0.5rem",
          color: "var(--brand-rust)",
        }}
        title="Delete certificate?"
      >
        <Trash2 size={11} />
      </ConfirmSubmitButton>
    </form>
  );
}
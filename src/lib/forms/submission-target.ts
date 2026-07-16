import type { FormKind } from "@/lib/forms/definition";

type PublicFormTargetInput = {
  kind: FormKind;
  linkedEventId?: null | string;
  slug: string;
};

export function resolvePublicFormSubmissionTarget({
  kind,
  linkedEventId,
  slug,
}: PublicFormTargetInput) {
  if (kind === "event_registration") {
    if (!linkedEventId) {
      return null;
    }

    return {
      confirmationRequired: false,
      endpoint: `/api/events/${encodeURIComponent(linkedEventId)}/register`,
    };
  }

  return {
    confirmationRequired: true,
    endpoint: `/api/forms/${encodeURIComponent(slug)}/submit`,
  };
}

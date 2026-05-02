export type WorkplaceUpdatePayload = {
  currentOrganization?: string;
  designation?: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  professionalVisibility?: string;
  websiteUrl?: string;
  workLocation?: string;
};

const WORKPLACE_FIELD_LABELS: Record<keyof WorkplaceUpdatePayload, string> = {
  currentOrganization: "Current organization",
  designation: "Designation",
  facebookUrl: "Facebook URL",
  linkedinUrl: "LinkedIn URL",
  professionalVisibility: "Visibility",
  websiteUrl: "Website URL",
  workLocation: "Work location",
};

export function parseWorkplaceUpdatePayload(
  payload: unknown
): WorkplaceUpdatePayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  const record = payload as Record<string, unknown>;

  return {
    currentOrganization:
      typeof record.currentOrganization === "string"
        ? record.currentOrganization
        : undefined,
    designation:
      typeof record.designation === "string" ? record.designation : undefined,
    facebookUrl:
      typeof record.facebookUrl === "string" ? record.facebookUrl : undefined,
    linkedinUrl:
      typeof record.linkedinUrl === "string" ? record.linkedinUrl : undefined,
    professionalVisibility:
      typeof record.professionalVisibility === "string"
        ? record.professionalVisibility
        : undefined,
    websiteUrl:
      typeof record.websiteUrl === "string" ? record.websiteUrl : undefined,
    workLocation:
      typeof record.workLocation === "string" ? record.workLocation : undefined,
  };
}

export function getWorkplacePayloadEntries(payload: unknown) {
  const parsed = parseWorkplaceUpdatePayload(payload);

  return (Object.entries(parsed) as [keyof WorkplaceUpdatePayload, string | undefined][])
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => ({
      key,
      label: WORKPLACE_FIELD_LABELS[key],
      value: value as string,
    }));
}

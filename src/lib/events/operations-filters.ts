export const EVENT_REGISTRATION_STATUSES = [
  "all",
  "cancelled",
  "checked-in",
  "confirmed",
  "waitlisted",
] as const;

export type EventRegistrationStatus =
  (typeof EVENT_REGISTRATION_STATUSES)[number];

export type EventRegistrationFilters = {
  query: string;
  status: EventRegistrationStatus;
};

export function parseEventRegistrationFilters(url: URL): EventRegistrationFilters {
  const rawStatus = url.searchParams.get("status");
  const status = EVENT_REGISTRATION_STATUSES.includes(
    rawStatus as EventRegistrationStatus
  )
    ? (rawStatus as EventRegistrationStatus)
    : "all";

  return {
    query: (url.searchParams.get("q") || "").trim().slice(0, 100),
    status,
  };
}

export function escapeEventRegistrationSearch(value: string) {
  return value.replace(/[\\%_,().]/g, (character) => `\\${character}`);
}

export function eventRegistrationExportSearch(filters: EventRegistrationFilters) {
  const search = new URLSearchParams();
  if (filters.query) search.set("q", filters.query);
  if (filters.status !== "all") search.set("status", filters.status);
  const value = search.toString();
  return value ? `&${value}` : "";
}

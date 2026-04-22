export const EVENT_CATEGORIES = [
  "workshop-training",
  "competition",
  "member-outreach",
  "ceremony-community",
  "community-social",
  "institutional",
  "tour",
  "other-real-event",
] as const;

export const EVENT_DELIVERY_MODES = [
  "offline",
  "online-or-hybrid",
  "unknown",
] as const;

export const EVENT_LOCATION_MODES = [
  "venue",
  "online",
  "hybrid",
  "tba",
] as const;

export const EVENT_REGISTRATION_MODES = [
  "internal",
  "external",
  "none",
] as const;

export const EVENT_STATUSES = ["draft", "published", "archived"] as const;

export const EVENTS_PER_PAGE = 12;
export const EVENT_MEDIA_PICKER_PAGE_SIZE = 24;

export type EventArchiveView = "past" | "upcoming";

export function toEventCategoryLabel(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function toEventDeliveryModeLabel(value: string) {
  if (value === "offline") {
    return "Offline";
  }

  if (value === "online-or-hybrid") {
    return "Online or Hybrid";
  }

  if (value === "unknown") {
    return "Format TBA";
  }

  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

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
export type EventRichTextFormat = "markdown" | "html" | "plain";

const EVENT_METADATA_TRAILER_PATTERN =
  /^\s*(?:[-*+]\s*)?(?:>\s*)?(?:\*\*)?(?:Event type|Delivery mode|Date)(?:\*\*)?\s*:\s*.+$/i;

export function stripEventMetadataTrailer(source: string) {
  const lines = source.replace(/\r\n/g, "\n").trimEnd().split("\n");
  let end = lines.length;

  while (end > 0 && !lines[end - 1]?.trim()) {
    end -= 1;
  }

  let cursor = end;

  while (
    cursor > 0 &&
    EVENT_METADATA_TRAILER_PATTERN.test(lines[cursor - 1] || "")
  ) {
    cursor -= 1;
  }

  if (cursor === end) {
    return source.trim();
  }

  while (cursor > 0 && !lines[cursor - 1]?.trim()) {
    cursor -= 1;
  }

  return lines.slice(0, cursor).join("\n").trim();
}

// UX-FIX-R3: global tag formatter
export function formatTag(value: string) {
  const smallWords = new Set(["and", "or", "of", "to", "the", "a", "an"]);

  return value
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part, index) => {
      const normalized = part.toLowerCase();

      if (index > 0 && smallWords.has(normalized)) {
        return normalized;
      }

      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join(" ");
}

export function toEventCategoryLabel(value: string) {
  // UX-FIX-R3: global tag formatter
  return formatTag(value);
}

export function toEventDeliveryModeLabel(value: string) {
  if (value === "unknown") {
    return "Format TBA";
  }

  // UX-FIX-R3: global tag formatter
  return formatTag(value);
}

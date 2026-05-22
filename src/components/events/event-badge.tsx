import type { ReactNode } from "react";
import { formatTag } from "@/lib/content/events";

type EventBadgeTone = "category" | "registration" | "status";

type EventBadgeProps = {
  children: ReactNode;
  tone: EventBadgeTone;
};

// UX-FIX: Badge/tag inconsistency
export function EventBadge({ children, tone }: EventBadgeProps) {
  // UX-FIX-R3: global tag formatter
  const label = typeof children === "string" ? formatTag(children) : children;
  const pillTone = tone === "category" ? "category" : "status"; // UX-R4: unified tag pill

  return <span className={`tag-pill tag-pill--${pillTone} event-badge event-badge--${tone}`}>{label}</span>; // UX-R4: unified tag pill
}

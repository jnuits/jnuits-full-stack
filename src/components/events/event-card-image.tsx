"use client";

import Image from "next/image";
import { useState } from "react";
import { CalendarDays, Code2, Trophy, UsersRound } from "lucide-react";

type EventCardImageProps = {
  alt: string;
  category?: string | null;
  priority?: boolean;
  sizes: string;
  src: string | null | undefined;
};

function EventImagePlaceholderIcon({
  category,
}: {
  category?: string | null;
}) {
  const normalized = String(category || "").toLowerCase();

  if (normalized.includes("competition") || normalized.includes("hackathon")) {
    return <Trophy size={34} strokeWidth={1.5} />;
  }

  if (normalized.includes("workshop") || normalized.includes("training")) {
    return <Code2 size={34} strokeWidth={1.5} />;
  }

  if (normalized.includes("member") || normalized.includes("community")) {
    return <UsersRound size={34} strokeWidth={1.5} />;
  }

  return <CalendarDays size={34} strokeWidth={1.5} />;
}

function EventImagePlaceholder({
  category,
  visible,
}: {
  category?: string | null;
  visible: boolean;
}) {
  return (
    <div
      className={`event-card__placeholder event-card__placeholder--image event-image-placeholder${visible ? " event-image-placeholder--visible" : ""}`}
    >
      <span className="event-image-placeholder__icon" aria-hidden="true">
        <EventImagePlaceholderIcon category={category} />
      </span>
      <span>Event image coming soon</span>
    </div>
  );
}

// UX-FIX: Broken image fallback
export function EventCardImage({
  alt,
  category,
  priority = false,
  sizes,
  src,
}: EventCardImageProps) {
  const imageSrc = typeof src === "string" ? src.trim() : src; // UX-R4: broken image fallback
  const [hasFailed, setHasFailed] = useState(!imageSrc); // UX-R4: broken image fallback

  if (!imageSrc) { // UX-R4: broken image fallback
    return <EventImagePlaceholder category={category} visible />;
  }

  return (
    <>
      <Image
        alt={alt}
        className={`object-cover event-card-image${hasFailed ? " event-card-image--hidden" : ""}`}
        fill
        onError={(event) => {
          // UX-FIX-R3: broken image fallback
          event.currentTarget.closest(".card-image")?.classList.add("img-fallback");
          setHasFailed(true);
        }}
        priority={priority}
        sizes={sizes}
        src={imageSrc}
      />
      <EventImagePlaceholder category={category} visible={hasFailed} />
    </>
  );
}

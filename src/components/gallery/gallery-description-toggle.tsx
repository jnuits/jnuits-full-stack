"use client";

import { useState } from "react";

type GalleryDescriptionToggleProps = {
  text: string;
};

export function GalleryDescriptionToggle({
  text,
}: GalleryDescriptionToggleProps) {
  const [expanded, setExpanded] = useState(false);
  const shouldToggle = text.length > 260;

  return (
    <div className="mt-5">
      <p
        className={`section-copy ${
          expanded ? "" : "gallery-hero-description"
        }`}
      >
        {text}
      </p>
      {shouldToggle ? (
        <button
          aria-expanded={expanded}
          className="gallery-description-toggle"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}

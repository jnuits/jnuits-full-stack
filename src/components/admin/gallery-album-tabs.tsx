"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type GalleryAlbumTabsProps = {
  details: ReactNode;
  media: ReactNode;
  mediaCount: number;
  removedCount: number;
};

export function GalleryAlbumTabs({
  details,
  media,
  mediaCount,
  removedCount,
}: GalleryAlbumTabsProps) {
  const [activeTab, setActiveTab] = useState<"details" | "media">("media");

  return (
    <section className="admin-editor-tabs">
      <div aria-label="Gallery album editor sections" className="admin-editor-tabs__list" role="tablist">
        <button
          aria-controls="album-details-panel"
          aria-selected={activeTab === "details"}
          className="admin-editor-tabs__tab"
          id="album-details-tab"
          onClick={() => setActiveTab("details")}
          role="tab"
          type="button"
        >
          Album Details
          {removedCount > 0 ? (
            <span className="admin-editor-tabs__count">{removedCount} removed</span>
          ) : null}
        </button>
        <button
          aria-controls="album-media-panel"
          aria-selected={activeTab === "media"}
          className="admin-editor-tabs__tab"
          id="album-media-tab"
          onClick={() => setActiveTab("media")}
          role="tab"
          type="button"
        >
          Manage Media
          <span className="admin-editor-tabs__count">{mediaCount} photos</span>
        </button>
      </div>

      <div
        aria-labelledby="album-details-tab"
        hidden={activeTab !== "details"}
        id="album-details-panel"
        role="tabpanel"
      >
        {details}
      </div>
      <div
        aria-labelledby="album-media-tab"
        hidden={activeTab !== "media"}
        id="album-media-panel"
        role="tabpanel"
      >
        {media}
      </div>
    </section>
  );
}

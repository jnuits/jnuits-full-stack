"use client";

import { useMemo, useState } from "react";

type TabDefinition = {
  content: React.ReactNode;
  count?: string;
  id: string;
  label: string;
};

type AdminEditorTabsProps = {
  tabs: TabDefinition[];
};

export function AdminEditorTabs({ tabs }: AdminEditorTabsProps) {
  const availableTabs = useMemo(() => tabs.filter(Boolean), [tabs]);
  const [activeTabId, setActiveTabId] = useState(availableTabs[0]?.id || "");

  return (
    <section className="admin-editor-tabs">
      <div
        aria-label="Editor sections"
        className="admin-editor-tabs__list"
        role="tablist"
      >
        {availableTabs.map((tab) => (
          <button
            aria-controls={`${tab.id}-panel`}
            aria-selected={activeTabId === tab.id}
            className="admin-editor-tabs__tab"
            id={`${tab.id}-tab`}
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            role="tab"
            type="button"
          >
            <span>{tab.label}</span>
            {tab.count ? (
              <span className="admin-editor-tabs__count">{tab.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {availableTabs.map((tab) => (
        <div
          aria-labelledby={`${tab.id}-tab`}
          hidden={activeTabId !== tab.id}
          id={`${tab.id}-panel`}
          key={tab.id}
          role="tabpanel"
        >
          {tab.content}
        </div>
      ))}
    </section>
  );
}

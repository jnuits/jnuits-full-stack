"use client";

import { useRouter } from "next/navigation";

function EmptySearchIllustration() {
  return (
    <svg aria-hidden="true" fill="none" height="64" viewBox="0 0 64 64" width="64">
      <circle
        cx="26"
        cy="26"
        fill="none"
        opacity="0.3"
        r="16"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <line
        opacity="0.3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.5"
        x1="38"
        x2="54"
        y1="38"
        y2="54"
      />
      <line
        opacity="0.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
        x1="20"
        x2="32"
        y1="26"
        y2="26"
      />
      <line
        opacity="0.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
        x1="26"
        x2="26"
        y1="20"
        y2="32"
      />
    </svg>
  );
}

export function MemberDirectoryEmptyState() {
  const router = useRouter();

  return (
    <div className="empty-state">
      <EmptySearchIllustration />
      <p className="empty-title">No members found</p>
      <p className="empty-sub">Try adjusting your search or filters</p>
      <button
        className="reset-btn"
        onClick={() => router.replace("/members", { scroll: false })}
        type="button"
      >
        Reset filters
      </button>
    </div>
  );
}

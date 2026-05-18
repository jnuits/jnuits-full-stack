"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type NoticePermalinkCopyProps = {
  permalink: string;
};

export function NoticePermalinkCopy({ permalink }: NoticePermalinkCopyProps) {
  const [copied, setCopied] = useState(false);

  async function copyPermalink() {
    const fullUrl = new URL(permalink, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="notice-permalink-copy">
      <span title={permalink}>{permalink}</span>
      <button
        aria-label={copied ? "Permalink copied" : "Copy full permalink"}
        onClick={copyPermalink}
        type="button"
      >
        {copied ? (
          <Check aria-hidden="true" size={14} />
        ) : (
          <Copy aria-hidden="true" size={14} />
        )}
      </button>
    </div>
  );
}

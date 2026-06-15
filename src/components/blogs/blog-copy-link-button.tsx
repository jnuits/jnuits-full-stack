"use client";

import { useState } from "react";

export function BlogCopyLinkButton() {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <>
      <button className="ghost-button" onClick={copyLink} type="button">
        {copied ? "Copied" : "Copy link"}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Article link copied to clipboard." : ""}
      </span>
    </>
  );
}

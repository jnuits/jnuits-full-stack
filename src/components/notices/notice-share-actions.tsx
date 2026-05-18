"use client";

import type { MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Check, MessageCircle, Send, Share2 } from "lucide-react";

type NoticeShareActionsProps = {
  title: string;
};

export function NoticeShareActions({ title }: NoticeShareActionsProps) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShareUrl(window.location.href);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const shareText = useMemo(
    () => `${title} - ${shareUrl}`,
    [shareUrl, title]
  );
  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(shareUrl);

  async function copyLink() {
    if (!shareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function nativeShare() {
    if (!shareUrl) {
      return;
    }

    if (!navigator.share) {
      await copyLink();
      return;
    }

    try {
      await navigator.share({
        text: title,
        title,
        url: shareUrl,
      });
    } catch {
      // Ignore share sheet cancellation.
    }
  }

  function preventEmptyShareUrl(event: MouseEvent<HTMLAnchorElement>) {
    if (!shareUrl) {
      event.preventDefault();
    }
  }

  return (
    <div className="notice-share-actions" aria-label="Share this notice">
      <button
        data-share-action="native"
        onClick={nativeShare}
        type="button"
      >
        {copied ? (
          <Check aria-hidden="true" size={15} />
        ) : (
          <Share2 aria-hidden="true" size={15} />
        )}
        {copied ? "Copied" : "Share"}
      </button>
      <a
        data-share-action="whatsapp"
        href={shareUrl ? `https://wa.me/?text=${encodedText}` : "#"}
        onClick={preventEmptyShareUrl}
        rel="noreferrer"
        target="_blank"
      >
        <MessageCircle aria-hidden="true" size={15} />
        WhatsApp
      </a>
      <a
        data-share-action="messenger"
        href={shareUrl ? `fb-messenger://share/?link=${encodedUrl}` : "#"}
        onClick={preventEmptyShareUrl}
        rel="noreferrer"
      >
        <Send aria-hidden="true" size={15} />
        Messenger
      </a>
    </div>
  );
}

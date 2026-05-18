"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, MessageCircle, Send, Share2 } from "lucide-react";

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

  return (
    <div className="notice-share-actions" aria-label="Share this notice">
      <button disabled={!shareUrl} onClick={nativeShare} type="button">
        <Share2 aria-hidden="true" size={15} />
        Share
      </button>
      <a
        href={shareUrl ? `https://wa.me/?text=${encodedText}` : "#"}
        rel="noreferrer"
        target="_blank"
      >
        <MessageCircle aria-hidden="true" size={15} />
        WhatsApp
      </a>
      <a
        href={shareUrl ? `fb-messenger://share/?link=${encodedUrl}` : "#"}
        rel="noreferrer"
      >
        <Send aria-hidden="true" size={15} />
        Messenger
      </a>
      <button disabled={!shareUrl} onClick={copyLink} type="button">
        {copied ? (
          <Check aria-hidden="true" size={15} />
        ) : (
          <Copy aria-hidden="true" size={15} />
        )}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clipboard, MessageCircle, Share2 } from "lucide-react";

type EventShareActionsProps = {
  title: string;
  url: string;
};

export function EventShareActions({ title, url }: EventShareActionsProps) {
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const updateShareMode = () => {
      setIsMobile(mediaQuery.matches);
      setCanNativeShare(typeof navigator.share === "function");
    };

    updateShareMode();
    mediaQuery.addEventListener("change", updateShareMode);

    return () => mediaQuery.removeEventListener("change", updateShareMode);
  }, []);

  const encodedTitle = useMemo(() => encodeURIComponent(title), [title]);
  const encodedUrl = useMemo(() => encodeURIComponent(url), [url]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // UX-R6: copy link fallback
      const fallbackInput = document.createElement("textarea");
      fallbackInput.value = url;
      fallbackInput.setAttribute("readonly", "");
      fallbackInput.style.position = "fixed";
      fallbackInput.style.opacity = "0";
      document.body.appendChild(fallbackInput);
      fallbackInput.select();
      const copiedWithFallback = document.execCommand("copy");
      document.body.removeChild(fallbackInput);
      setCopied(copiedWithFallback);
      if (copiedWithFallback) {
        window.setTimeout(() => setCopied(false), 2000);
      }
    }
  }

  async function nativeShare() {
    if (!canNativeShare) {
      await copyLink();
      return;
    }

    try {
      await navigator.share({ title, url });
    } catch {
      // Ignore cancelled native share sheets.
    }
  }

  function openShareUrl(shareUrl: string) {
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  }

  if (isMobile && canNativeShare) {
    return (
      <div className="event-share-bar" aria-label="Share this event">
        {/* UX-R6: mobile native share */}
        <button className="event-share-button event-share-button--native" onClick={nativeShare} type="button">
          <Share2 aria-hidden="true" size={15} />
          <span>Share</span>
        </button>
      </div>
    );
  }

  return (
    <div className="event-share-bar" aria-label="Share this event">
      {/* UX-R6: copy event link */}
      <button aria-label={copied ? "Copied event link" : "Copy event link"} className="event-share-icon-button" data-copied={copied ? "true" : "false"} onClick={copyLink} type="button">
        {copied ? <Check aria-hidden="true" size={15} /> : <Clipboard aria-hidden="true" size={15} />}
        <span className="event-share-tooltip">{copied ? "Copied!" : "Copy link"}</span>
      </button>
      {/* UX-R6: facebook share */}
      <button
        aria-label="Share on Facebook"
        className="event-share-icon-button"
        onClick={() =>
          openShareUrl(
            `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
          )
        }
        type="button"
      >
        <span aria-hidden="true" className="event-share-brand">f</span>
      </button>
      {/* UX-R6: x share */}
      <button
        aria-label="Share on X"
        className="event-share-icon-button"
        onClick={() =>
          openShareUrl(
            `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`
          )
        }
        type="button"
      >
        <span aria-hidden="true" className="event-share-brand">X</span>
      </button>
      {/* UX-R6: whatsapp share */}
      <button
        aria-label="Share on WhatsApp"
        className="event-share-icon-button"
        onClick={() =>
          openShareUrl(`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`)
        }
        type="button"
      >
        <MessageCircle aria-hidden="true" size={15} />
      </button>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import Script from "next/script";

type TurnstileEventName = "turnstile:success" | "turnstile:error" | "turnstile:expired";

type TurnstileWidgetProps = {
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpired?: () => void;
};

declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void;
    onTurnstileError?: () => void;
    onTurnstileExpired?: () => void;
  }
}

function dispatchTurnstileEvent(name: TurnstileEventName, detail?: string) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function TurnstileWidget({ onSuccess, onError, onExpired }: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  useEffect(() => {
    window.onTurnstileSuccess = (token: string) => {
      dispatchTurnstileEvent("turnstile:success", token);
    };
    window.onTurnstileError = () => {
      dispatchTurnstileEvent("turnstile:error");
    };
    window.onTurnstileExpired = () => {
      dispatchTurnstileEvent("turnstile:expired");
    };

    const handleSuccess = (event: Event) => {
      onSuccess((event as CustomEvent<string>).detail);
    };
    const handleError = () => onError?.();
    const handleExpired = () => onExpired?.();

    window.addEventListener("turnstile:success", handleSuccess);
    window.addEventListener("turnstile:error", handleError);
    window.addEventListener("turnstile:expired", handleExpired);

    if (!siteKey || siteKey === "your_site_key_here") {
      handleError();
    }

    return () => {
      window.removeEventListener("turnstile:success", handleSuccess);
      window.removeEventListener("turnstile:error", handleError);
      window.removeEventListener("turnstile:expired", handleExpired);
      delete window.onTurnstileSuccess;
      delete window.onTurnstileError;
      delete window.onTurnstileExpired;
    };
  }, [onError, onExpired, onSuccess, siteKey]);

  return (
    <div className="mt-2" suppressHydrationWarning>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
        onError={onError}
      />
      <div
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-theme="auto"
        data-callback="onTurnstileSuccess"
        data-error-callback="onTurnstileError"
        data-expired-callback="onTurnstileExpired"
        suppressHydrationWarning
      />
    </div>
  );
}

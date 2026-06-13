"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  removeTurnstileWidget,
  renderTurnstileWidget,
  resetTurnstileWidget,
  type TurnstileApi,
} from "@/lib/security/turnstile-client";

type TurnstileWidgetProps = {
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpired?: () => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget({ onSuccess, onError, onExpired }: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const disabled = !siteKey || siteKey === "your_site_key_here";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callbacksRef = useRef({ onError, onExpired, onSuccess });
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    callbacksRef.current = { onError, onExpired, onSuccess };
  }, [onError, onExpired, onSuccess]);

  const renderWidget = useCallback(() => {
    if (disabled || !containerRef.current || !window.turnstile || widgetIdRef.current) {
      return;
    }

    const resetWidget = () => {
      resetTurnstileWidget(window.turnstile, widgetIdRef.current);
    };

    widgetIdRef.current = renderTurnstileWidget({
      container: containerRef.current,
      onError: () => {
        resetWidget();
        callbacksRef.current.onError?.();
      },
      onExpired: () => {
        resetWidget();
        callbacksRef.current.onExpired?.();
      },
      onSuccess: (token) => callbacksRef.current.onSuccess(token),
      siteKey,
      turnstile: window.turnstile,
    });
  }, [disabled, siteKey]);

  useEffect(() => {
    if (disabled) {
      callbacksRef.current.onError?.();
      return undefined;
    }

    renderWidget();

    return () => {
      removeTurnstileWidget(window.turnstile, widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [disabled, onError, renderWidget, scriptReady]);

  if (disabled) {
    return null;
  }

  return (
    <div className="mt-2" suppressHydrationWarning>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="lazyOnload"
        onError={() => callbacksRef.current.onError?.()}
        onLoad={() => {
          setScriptReady(true);
        }}
        onReady={() => {
          setScriptReady(true);
        }}
      />
      <div ref={containerRef} suppressHydrationWarning />
    </div>
  );
}

"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  removeTurnstileWidget,
  renderTurnstileWidget,
  resetTurnstileWidget,
  type TurnstileApi,
} from "@/lib/security/turnstile-client";

type TurnstileFieldProps = {
  siteKey: string;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileField({ siteKey }: TurnstileFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [scriptReady, setScriptReady] = useState(false);

  const renderWidget = useCallback(() => {
    if (!siteKey || !containerRef.current || !window.turnstile || widgetIdRef.current) {
      return;
    }

    const resetWidget = () => {
      setToken("");
      resetTurnstileWidget(window.turnstile, widgetIdRef.current);
    };

    widgetIdRef.current = renderTurnstileWidget({
      container: containerRef.current,
      onError: resetWidget,
      onExpired: resetWidget,
      onSuccess: setToken,
      siteKey,
      turnstile: window.turnstile,
    });
  }, [siteKey]);

  useEffect(() => {
    renderWidget();

    return () => {
      removeTurnstileWidget(window.turnstile, widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [renderWidget, scriptReady]);

  if (!siteKey) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <Script
        async
        defer
        onLoad={() => {
          setScriptReady(true);
        }}
        onReady={() => {
          setScriptReady(true);
        }}
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      />
      <div ref={containerRef} />
      <input name="captchaToken" type="hidden" value={token} />
    </div>
  );
}

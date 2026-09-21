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
  /** Hidden control name. Defaults to the legacy name for existing consumers. */
  name?: string;
  /**
   * Optional. Reports the current token, empty when unverified.
   *
   * Exists so a parent can collapse the widget once it is satisfied and confirm
   * success in its own design language. The hidden input below remains the
   * submission mechanism either way, so a consumer that ignores this keeps the
   * previous behaviour exactly.
   */
  onTokenChange?: (token: string) => void;
  siteKey: string;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileField({ name = "captchaToken", onTokenChange, siteKey }: TurnstileFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const [token, setToken] = useState("");
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  /**
   * Reported from here rather than from inside `setToken` because the error and
   * expiry paths clear the token too. One effect keyed on the token means every
   * transition is reported, including recovery, so a parent that collapses on
   * success re-expands on expiry without extra wiring. Otherwise a respondent
   * whose challenge expired would be left facing a hidden widget.
   */
  useEffect(() => {
    onTokenChangeRef.current?.(token);
  }, [token]);

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
    <div className="grid gap-2 min-w-0 max-w-full overflow-hidden">
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
      <div ref={containerRef} className="min-w-0 max-w-full overflow-hidden" />
      <input name={name} type="hidden" value={token} />
    </div>
  );
}

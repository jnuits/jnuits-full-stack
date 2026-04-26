"use client";

import Script from "next/script";
import { useId, useState } from "react";

type TurnstileFieldProps = {
  siteKey: string;
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          callback: (token: string) => void;
          sitekey: string;
          theme?: "auto" | "dark" | "light";
        }
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

export function TurnstileField({ siteKey }: TurnstileFieldProps) {
  const containerId = useId().replaceAll(":", "-");
  const [token, setToken] = useState("");
  const [widgetId, setWidgetId] = useState<string | null>(null);

  if (!siteKey) {
    return null;
  }

  function renderWidget() {
    const container = document.getElementById(containerId);

    if (!container || !window.turnstile || widgetId) {
      return;
    }

    const id = window.turnstile.render(container, {
      callback: setToken,
      sitekey: siteKey,
      theme: "auto",
    });

    setWidgetId(id);
  }

  return (
    <div className="grid gap-2">
      <Script
        async
        defer
        onLoad={renderWidget}
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      />
      <div id={containerId} />
      <input name="captchaToken" type="hidden" value={token} />
    </div>
  );
}

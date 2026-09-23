export type TurnstileWidgetId = string;
export type TurnstileWidgetSize = "compact" | "flexible" | "normal";

export type TurnstileApi = {
  remove: (widgetId: TurnstileWidgetId) => void;
  render: (
    container: HTMLElement,
    options: {
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      sitekey: string;
      size?: TurnstileWidgetSize;
      theme?: "auto" | "dark" | "light";
    }
  ) => TurnstileWidgetId;
  reset: (widgetId?: TurnstileWidgetId) => void;
};

export function renderTurnstileWidget(options: {
  container: HTMLElement;
  onError?: () => void;
  onExpired?: () => void;
  onSuccess: (token: string) => void;
  size?: TurnstileWidgetSize;
  siteKey: string;
  turnstile: TurnstileApi;
}) {
  return options.turnstile.render(options.container, {
    callback: options.onSuccess,
    "error-callback": options.onError,
    "expired-callback": options.onExpired,
    sitekey: options.siteKey,
    size: options.size ?? "flexible",
    theme: "auto",
  });
}

export function resetTurnstileWidget(
  turnstile: TurnstileApi | undefined,
  widgetId: TurnstileWidgetId | null
) {
  if (turnstile && widgetId) {
    turnstile.reset(widgetId);
  }
}

export function removeTurnstileWidget(
  turnstile: TurnstileApi | undefined,
  widgetId: TurnstileWidgetId | null
) {
  if (turnstile && widgetId) {
    turnstile.remove(widgetId);
  }
}

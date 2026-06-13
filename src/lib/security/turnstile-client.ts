export type TurnstileWidgetId = string;

export type TurnstileApi = {
  remove: (widgetId: TurnstileWidgetId) => void;
  render: (
    container: HTMLElement,
    options: {
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      sitekey: string;
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
  siteKey: string;
  turnstile: TurnstileApi;
}) {
  return options.turnstile.render(options.container, {
    callback: options.onSuccess,
    "error-callback": options.onError,
    "expired-callback": options.onExpired,
    sitekey: options.siteKey,
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

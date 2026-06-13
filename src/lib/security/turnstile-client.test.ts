import { describe, expect, it, vi } from "vitest";
import {
  removeTurnstileWidget,
  renderTurnstileWidget,
  resetTurnstileWidget,
  type TurnstileApi,
} from "@/lib/security/turnstile-client";

describe("turnstile client helpers", () => {
  it("renders, forwards token callbacks, resets, and removes a widget", () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onExpired = vi.fn();
    const turnstile: TurnstileApi = {
      remove: vi.fn(),
      render: vi.fn((_container, options) => {
        options.callback("token-123");
        options["error-callback"]?.();
        options["expired-callback"]?.();
        return "widget-1";
      }),
      reset: vi.fn(),
    };

    const widgetId = renderTurnstileWidget({
      container: {} as HTMLElement,
      onError,
      onExpired,
      onSuccess,
      siteKey: "site-key",
      turnstile,
    });

    resetTurnstileWidget(turnstile, widgetId);
    removeTurnstileWidget(turnstile, widgetId);

    expect(widgetId).toBe("widget-1");
    expect(onSuccess).toHaveBeenCalledWith("token-123");
    expect(onError).toHaveBeenCalledOnce();
    expect(onExpired).toHaveBeenCalledOnce();
    expect(turnstile.reset).toHaveBeenCalledWith("widget-1");
    expect(turnstile.remove).toHaveBeenCalledWith("widget-1");
  });
});

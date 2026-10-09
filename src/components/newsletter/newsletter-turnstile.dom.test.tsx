import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewsletterSubscribeForm } from "./newsletter-subscribe-form";
import type { TurnstileApi } from "@/lib/security/turnstile-client";

describe("footer newsletter CAPTCHA", () => {
  let challenge: Parameters<TurnstileApi["render"]>[1] | undefined;
  const reset = vi.fn();

  beforeEach(() => {
    challenge = undefined;
    window.turnstile = {
      remove: vi.fn(),
      render: (_container, options) => {
        challenge = options;
        return "footer-widget";
      },
      reset,
    };
  });

  afterEach(() => {
    delete window.turnstile;
    vi.clearAllMocks();
  });

  it("uses the dark footer theme regardless of the visitor's system preference", async () => {
    render(<NewsletterSubscribeForm siteKey="test-site-key" />);
    await waitFor(() => expect(challenge?.theme).toBe("dark"));
  });

  it("clears the submitted CAPTCHA token and resets its challenge on expiry", async () => {
    const { container } = render(<NewsletterSubscribeForm siteKey="test-site-key" />);
    await waitFor(() => expect(challenge).toBeDefined());
    const token = container.querySelector<HTMLInputElement>('input[name="captchaToken"]')!;

    act(() => challenge?.callback("test-token"));
    await waitFor(() => expect(token.value).toBe("test-token"));
    act(() => challenge?.["expired-callback"]?.());
    await waitFor(() => expect(token.value).toBe(""));
    expect(reset).toHaveBeenCalledWith("footer-widget");
  });
});

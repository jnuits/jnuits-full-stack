import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewsletterSubscribeForm } from "./newsletter-subscribe-form";

describe("NewsletterSubscribeForm", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders email input with id='footer-newsletter-email' and unchecked consent", () => {
    render(<NewsletterSubscribeForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("id", "footer-newsletter-email");
    expect(emailInput).toHaveAttribute("type", "email");

    const consentCheckbox = screen.getByRole("checkbox");
    expect(consentCheckbox).toBeInTheDocument();
    expect(consentCheckbox).not.toBeChecked();

    const submitBtn = screen.getByRole("button", { name: /subscribe/i });
    expect(submitBtn).toBeDisabled();
  });

  it("enables submit button only when consent checkbox is checked", async () => {
    const user = userEvent.setup();
    render(<NewsletterSubscribeForm />);

    const consentCheckbox = screen.getByRole("checkbox");
    const submitBtn = screen.getByRole("button", { name: /subscribe/i });

    expect(submitBtn).toBeDisabled();

    await user.click(consentCheckbox);
    expect(consentCheckbox).toBeChecked();
    expect(submitBtn).not.toBeDisabled();
  });

  it("submits JSON to /api/newsletter/subscribe with honeypot and consent", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ status: "accepted" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewsletterSubscribeForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    const consentCheckbox = screen.getByRole("checkbox");
    const submitBtn = screen.getByRole("button", { name: /subscribe/i });

    await user.type(emailInput, "subscriber@example.com");
    await user.click(consentCheckbox);
    await user.click(submitBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/newsletter/subscribe",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            captchaToken: "",
            consent: true,
            email: "subscriber@example.com",
            website: "",
          }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });

  it("handles 429 rate limiting with a retryable error message", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "rate_limited", message: "Too many requests" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewsletterSubscribeForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    const consentCheckbox = screen.getByRole("checkbox");
    const submitBtn = screen.getByRole("button", { name: /subscribe/i });

    await user.type(emailInput, "busy@example.com");
    await user.click(consentCheckbox);
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/too many requests/i)).toBeInTheDocument();
    });

    // Retry resets error
    const retryBtn = screen.getByRole("button", { name: /try again/i });
    await user.click(retryBtn);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

import { renderToStaticMarkup } from "react-dom/server";
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

  it("keeps newsletter controls disabled in server HTML until hydration can capture input", () => {
    const html = renderToStaticMarkup(<NewsletterSubscribeForm siteKey="" />);
    const document = new DOMParser().parseFromString(html, "text/html");
    expect(document.querySelector<HTMLInputElement>("#footer-newsletter-email")?.disabled).toBe(true);
    expect(document.querySelector<HTMLInputElement>("#footer-newsletter-consent")?.disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
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

    // Retry resets error and focuses email input
    const retryBtn = screen.getByRole("button", { name: /try again/i });
    await user.click(retryBtn);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(emailInput).toHaveFocus();
  });

  it("maps invalid_input and captcha_failed machine codes to helpful human messages", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_input" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewsletterSubscribeForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    const consentCheckbox = screen.getByRole("checkbox");
    const submitBtn = screen.getByRole("button", { name: /subscribe/i });

    await user.type(emailInput, "bad@example.com");
    await user.click(consentCheckbox);
    await user.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/please enter a valid email address and verify the required fields/i)
      ).toBeInTheDocument();
    });

    // Test captcha_failed
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "captcha_failed" }),
    });

    await user.click(screen.getByRole("button", { name: /try again/i }));
    await user.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/security verification failed\. please complete the captcha and try again/i)
      ).toBeInTheDocument();
    });
  });
});

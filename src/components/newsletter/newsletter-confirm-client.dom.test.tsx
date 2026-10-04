import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewsletterConfirmClient } from "./newsletter-confirm-client";

describe("NewsletterConfirmClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does NOT perform confirmation on initial render (protecting against mail link scanners)", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<NewsletterConfirmClient initialToken="test-token-123" />);

    expect(screen.getByRole("heading", { name: /confirm your subscription/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm subscription/i })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits POST to /api/newsletter/confirm when user clicks confirm button", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "confirmed" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewsletterConfirmClient initialToken="valid-token-abc" />);

    const confirmBtn = screen.getByRole("button", { name: /confirm subscription/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/newsletter/confirm",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: "valid-token-abc" }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /subscription confirmed!/i })).toBeInTheDocument();
    });
  });

  it("renders preferences_required notice when provider preferences require manual review", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "preferences_required" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewsletterConfirmClient initialToken="pref-token" />);

    await user.click(screen.getByRole("button", { name: /confirm subscription/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /preferences update required/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /contact support/i })).toBeInTheDocument();
    });
  });

  it("renders invalid_token error state when link is unrecognized", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_token" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewsletterConfirmClient initialToken="bad-token" />);

    await user.click(screen.getByRole("button", { name: /confirm subscription/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /invalid confirmation link/i })).toBeInTheDocument();
    });
  });

  it("renders expired_token state with guidance to resubscribe", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 410,
      json: async () => ({ error: "expired_token" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewsletterConfirmClient initialToken="expired-token" />);

    await user.click(screen.getByRole("button", { name: /confirm subscription/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /confirmation link expired/i })).toBeInTheDocument();
    });
  });

  it("renders missing token error if loaded without token", () => {
    render(<NewsletterConfirmClient initialToken="" />);

    expect(screen.getByRole("heading", { name: /missing confirmation link/i })).toBeInTheDocument();
  });
});

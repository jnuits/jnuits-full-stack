import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { THEME_INIT_SCRIPT, ThemeInitScript } from "./theme-init-script";

describe("ThemeInitScript and inline execution logic", () => {
  beforeEach(() => {
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
    window.localStorage.clear();
  });

  function executeThemeScript() {
    // Execute the exact string injected into <head>
    // eslint-disable-next-line no-eval
    window.eval(THEME_INIT_SCRIPT);
  }

  it("renders script element with provided nonce", () => {
    const { container } = render(<ThemeInitScript nonce="test-request-nonce-xyz" />);
    const script = container.querySelector("script");
    expect(script).toBeTruthy();
    expect(script?.getAttribute("nonce")).toBe("test-request-nonce-xyz");
    expect(script?.innerHTML).toContain("jnuits-theme");
    expect(script?.innerHTML).toContain("data-theme");
  });

  it("proves the pre-fix failing state (light flash) when script is absent, and 0ms fix when script executes", () => {
    // Stored preference is dark
    window.localStorage.setItem("jnuits-theme", "dark");

    // Initial server-rendered DOM state (pre-fix) defaults to light
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.classList.remove("dark");

    // Before fix (no head script executed): DOM is still light despite stored dark preference!
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    // After fix: ThemeInitScript executes synchronously during <head> parsing
    executeThemeScript();

    // Now documentElement is immediately dark before any body content paints or React hydrates
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("applies stored 'dark' preference to documentElement before first paint", () => {
    window.localStorage.setItem("jnuits-theme", "dark");
    executeThemeScript();

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });


  it("applies stored 'light' preference to documentElement before first paint", () => {
    window.localStorage.setItem("jnuits-theme", "light");
    executeThemeScript();

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("falls back to system dark theme when no preference is stored", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    executeThemeScript();

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("falls back to system light theme when no preference is stored", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    executeThemeScript();

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("ignores invalid stored values and falls back to system theme", () => {
    window.localStorage.setItem("jnuits-theme", "not-a-valid-theme");
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    executeThemeScript();

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("falls back to system theme when storage reads throw (e.g. storage denied)", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: Access to Storage is denied");
    });
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    expect(() => executeThemeScript()).not.toThrow();

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("defaults to light theme if matchMedia is missing or throws", () => {
    window.matchMedia = vi.fn().mockImplementation(() => {
      throw new Error("matchMedia unavailable");
    });
    expect(() => executeThemeScript()).not.toThrow();

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

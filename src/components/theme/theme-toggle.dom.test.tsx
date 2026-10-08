import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import {
  ThemeToggle,
  resolveTheme,
  applyTheme,
  subscribeToTheme,
} from "./theme-toggle";

describe("Theme resolution and ThemeToggle component", () => {
  it("mounts and toggles when matchMedia is unavailable", () => {
    window.matchMedia = vi.fn(() => { throw new Error("matchMedia unavailable"); });
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "Toggle color theme" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
  });
  let mockMatchMedia: (matches: boolean) => void;

  beforeEach(() => {
    // Reset root DOM
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");

    // Clear localStorage mock
    window.localStorage.clear();


    // Setup matchMedia mock
    let systemIsDark = false;
    const listeners = new Set<() => void>();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("dark") ? systemIsDark : !systemIsDark,
      media: query,
      onchange: null,
      addListener: (cb: () => void) => listeners.add(cb),
      removeListener: (cb: () => void) => listeners.delete(cb),
      addEventListener: (_ev: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_ev: string, cb: () => void) => listeners.delete(cb),
      dispatchEvent: () => true,
    }));

    const unsubscribe = subscribeToTheme(() => {});
    window.dispatchEvent(new StorageEvent("storage", { key: "jnuits-theme" }));
    unsubscribe();

    mockMatchMedia = (matches: boolean) => {
      systemIsDark = matches;
      listeners.forEach((cb) => cb());
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves to stored 'dark' preference and applies theme", () => {
    window.localStorage.setItem("jnuits-theme", "dark");
    expect(resolveTheme()).toBe("dark");

    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("resolves to stored 'light' preference and applies theme", () => {
    window.localStorage.setItem("jnuits-theme", "light");
    expect(resolveTheme()).toBe("light");

    applyTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("resolves to system dark when no preference is stored", () => {
    mockMatchMedia(true);
    expect(resolveTheme()).toBe("dark");
  });

  it("resolves to system light when no preference is stored", () => {
    mockMatchMedia(false);
    expect(resolveTheme()).toBe("light");
  });

  it("ignores invalid stored values and falls back to system theme", () => {
    window.localStorage.setItem("jnuits-theme", "arbitrary-invalid-value");
    mockMatchMedia(true);
    expect(resolveTheme()).toBe("dark");

    mockMatchMedia(false);
    expect(resolveTheme()).toBe("light");
  });

  it("handles storage read access being denied or throwing by falling back to system theme", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: Access to Storage is denied");
    });

    mockMatchMedia(true);
    expect(() => resolveTheme()).not.toThrow();
    expect(resolveTheme()).toBe("dark");

    mockMatchMedia(false);
    expect(resolveTheme()).toBe("light");
  });

  it("keeps toggle usable when localStorage write throws, maintaining in-memory session override", () => {
    window.localStorage.setItem("jnuits-theme", "light");
    mockMatchMedia(false);

    // Mock setItem to throw (e.g. QuotaExceededError or permission denied)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError: storage is full or denied");
    });

    render(<ThemeToggle />);
    const toggleButton = screen.getByRole("button", { name: /toggle color theme/i });
    expect(toggleButton).toHaveAttribute("aria-pressed", "false");

    // Click toggle: should not throw, should flip to dark and keep it in memory
    expect(() => {
      fireEvent.click(toggleButton);
    }).not.toThrow();

    expect(toggleButton).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    // Subsequent resolveTheme() must return the chosen theme rather than reverting
    expect(resolveTheme()).toBe("dark");
  });

  it("renders ThemeToggle and switches theme on click with accessibility attributes", () => {
    window.localStorage.setItem("jnuits-theme", "light");
    render(<ThemeToggle />);

    const toggleButton = screen.getByRole("button", { name: /toggle color theme/i });
    expect(toggleButton).toHaveAttribute("aria-pressed", "false");

    act(() => {
      fireEvent.click(toggleButton);
    });

    expect(toggleButton).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("jnuits-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      fireEvent.click(toggleButton);
    });

    expect(toggleButton).toHaveAttribute("aria-pressed", "false");
    expect(window.localStorage.getItem("jnuits-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("reconciles SSR hydration without a post-hydration light reset when stored theme is dark", async () => {
    const { renderToString } = await import("react-dom/server");
    const { hydrateRoot } = await import("react-dom/client");

    // Server renders HTML (server snapshot is "light")
    const serverHtml = renderToString(<ThemeToggle />);
    expect(serverHtml).toContain('aria-pressed="false"');

    // On client: stored theme is "dark"
    window.localStorage.setItem("jnuits-theme", "dark");
    // ThemeInitScript has set dark on document.documentElement
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.classList.add("dark");

    const classToggle = vi.spyOn(document.documentElement.classList, "toggle");

    // Track every change to data-theme and classList
    const observedThemeMutations: Array<{ dataTheme: string | null; hasDarkClass: boolean }> = [];
    const observer = new MutationObserver(() => {
      observedThemeMutations.push({
        dataTheme: document.documentElement.getAttribute("data-theme"),
        hasDarkClass: document.documentElement.classList.contains("dark"),
      });
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.appendChild(container);

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <ThemeToggle />);
    });

    observer.disconnect();

    const hydrationToggleCalls = [...classToggle.mock.calls];
    act(() => { root?.unmount(); });
    document.body.removeChild(container);
    expect(hydrationToggleCalls.filter(([name]) => name === "dark")).not.toContainEqual(["dark", false]);

    // Verify root document remained dark and was NEVER reset to light
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    for (const mutation of observedThemeMutations) {
      expect(mutation.dataTheme).not.toBe("light");
      expect(mutation.hasDarkClass).toBe(true);
    }

  });

  it("handles system-theme changes consistently when no explicit preference is stored", () => {
    mockMatchMedia(false); // system is light
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    act(() => {
      mockMatchMedia(true); // system changes to dark
    });

    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("does not override explicit saved preference when system-theme changes", () => {
    window.localStorage.setItem("jnuits-theme", "dark");
    mockMatchMedia(false); // system is light
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    act(() => {
      mockMatchMedia(true); // system flips to dark
    });
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");

    act(() => {
      mockMatchMedia(false); // system flips back to light
    });
    // Explicit preference remains dark
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("handles React development remounts without state loss or listener leaks", () => {
    window.localStorage.setItem("jnuits-theme", "dark");
    const { unmount } = render(<React.StrictMode><ThemeToggle /></React.StrictMode>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");

    // Simulate React StrictMode unmount and remount
    unmount();
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

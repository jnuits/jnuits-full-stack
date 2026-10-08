"use client";

import { useEffect, useSyncExternalStore } from "react";

export const STORAGE_KEY = "jnuits-theme";
export const THEME_CHANGE_EVENT = "jnuits-theme-change";

export type Theme = "light" | "dark";

let inMemoryThemeOverride: Theme | null = null;

export function resolveTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  if (inMemoryThemeOverride === "light" || inMemoryThemeOverride === "dark") {
    return inMemoryThemeOverride;
  }

  let savedTheme: string | null = null;
  try {
    savedTheme = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    savedTheme = null;
  }

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

export function getServerThemeSnapshot(): Theme {
  return "light";
}

export function subscribeToTheme(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      inMemoryThemeOverride = null;
      callback();
    }
  };

  const handleSystemChange = () => {
    callback();
  };

  window.addEventListener(THEME_CHANGE_EVENT, callback);
  window.addEventListener("storage", handleStorage);
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleSystemChange);
  } else if (typeof (mediaQuery as { addListener?: (fn: () => void) => void }).addListener === "function") {
    (mediaQuery as { addListener: (fn: () => void) => void }).addListener(handleSystemChange);
  }

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
    if (typeof mediaQuery.removeEventListener === "function") {
      mediaQuery.removeEventListener("change", handleSystemChange);
    } else if (typeof (mediaQuery as { removeListener?: (fn: () => void) => void }).removeListener === "function") {
      (mediaQuery as { removeListener: (fn: () => void) => void }).removeListener(handleSystemChange);
    }
  };
}

export function announceThemeChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
}

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.7 5.3l-1.7 1.7M7 17l-1.7 1.7M18.7 18.7l-1.7-1.7M7 7l-1.7-1.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M12 16.1a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="M20.4 14.1a8.8 8.8 0 1 1-10.5-10.5A7.2 7.2 0 0 0 20.4 14.1Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    resolveTheme,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
      inMemoryThemeOverride = null;
    } catch {
      inMemoryThemeOverride = nextTheme;
    }
    applyTheme(nextTheme);
    announceThemeChange();
  }

  return (
    <button
      aria-label="Toggle color theme"
      aria-pressed={theme === "dark"}
      className="theme-toggle"
      onClick={toggleTheme}
      type="button"
    >
      <span className="theme-toggle__icon">
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  );
}

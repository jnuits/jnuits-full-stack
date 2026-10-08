import React from "react";

export const THEME_STORAGE_KEY = "jnuits-theme";

/**
 * Synchronous inline script executed before first paint in <head>.
 *
 * Guarantees:
 * 1. Reads stored 'jnuits-theme' preference; accepts ONLY 'light' or 'dark'.
 * 2. If storage access throws (e.g. security policy, cookies blocked, private mode),
 *    falls back gracefully to system color scheme.
 * 3. If stored value is absent or invalid, falls back to system color scheme via matchMedia.
 * 4. Synchronously sets data-theme attribute and .dark class on document.documentElement
 *    before body content is parsed.
 * 5. Uses server-provided request nonce to strictly comply with production strict-dynamic CSP.
 * 6. Wrapped in fail-safe try/catch so exceptions can never halt HTML parsing.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=null;try{var s=window.localStorage.getItem("jnuits-theme");if(s==="light"||s==="dark"){t=s;}}catch(e){}if(!t){try{t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}catch(e){t="light";}}var r=document.documentElement;r.setAttribute("data-theme",t);if(t==="dark"){r.classList.add("dark");}else{r.classList.remove("dark");}}catch(e){}})();`;

interface ThemeInitScriptProps {
  nonce?: string;
}

export function ThemeInitScript({ nonce }: ThemeInitScriptProps) {
  return (
    <script
      id="jnuits-theme-init"
      nonce={nonce}
      dangerouslySetInnerHTML={{
        __html: THEME_INIT_SCRIPT,
      }}
    />
  );
}

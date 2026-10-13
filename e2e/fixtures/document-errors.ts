import type { Page, Response } from "@playwright/test";

/** WebKit emits a native access-control diagnostic for the discarded realm's
 * queued Next prefetches during hard reload. It does not dispatch a document
 * error/unhandledrejection. Never exclude active-document or JavaScript errors.
 */
export function isRetiredDocumentPrefetch(error: Error, browserName: string, retiringOrigin: string | null): boolean {
  if (browserName !== "webkit" || !retiringOrigin) return false;
  const firstLine = error.stack?.split("\n", 1)[0];
  const match = /^Fetch API cannot load (https?:\/\/\S+) due to access control checks\.$/.exec(firstLine ?? "");
  if (!match) return false;
  try {
    const url = new URL(match[1]);
    return error.name === `Fetch API cannot load ${url.protocol.slice(0, -1)}` &&
      url.origin === retiringOrigin && url.searchParams.has("_rsc");
  } catch {
    return false;
  }
}

export function trackDocumentErrors(page: Page, browserName = "", providerError?: (error: Error) => boolean) {
  const errors: string[] = [];
  const retirementDiagnostics: { message: string; name: string }[] = [];
  let retiringOrigin: string | null = null;
  page.on("framenavigated", frame => {
    if (frame === page.mainFrame()) retiringOrigin = null;
  });
  page.on("pageerror", error => {
    if (providerError?.(error)) return;
    if (isRetiredDocumentPrefetch(error, browserName, retiringOrigin)) {
      retirementDiagnostics.push({ message: error.message, name: error.name });
    } else {
      errors.push(error.message);
    }
  });
  return {
    errors,
    retirementDiagnostics,
    reload: async (): Promise<Response | null> => {
      retiringOrigin = new URL(page.url()).origin;
      try {
        return await page.reload();
      } finally {
        retiringOrigin = null;
      }
    },
  };
}

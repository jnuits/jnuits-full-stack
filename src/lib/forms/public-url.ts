/**
 * Canonical public URL construction for published forms.
 *
 * The Form Studio previously built share links from `window.location.origin`,
 * which meant a link copied while browsing a preview deployment, localhost, or
 * an alternate host was handed to members in an unopenable form.
 *
 * This module deliberately reads no environment variable and touches no browser
 * global. The canonical base is always an explicit argument, resolved on the
 * server by `getAppBaseUrl()` and passed down. Two reasons:
 *
 *   1. `APP_BASE_URL` is not inlined into client bundles, so a client component
 *      that calls `getAppBaseUrl()` itself silently falls through to a weaker
 *      source or the hardcoded fallback.
 *   2. With no ambient origin reachable from inside this module, the browser
 *      origin cannot quietly creep back in later.
 */

export const PUBLIC_FORM_PATH_PREFIX = "/forms";

/**
 * @returns the canonical absolute URL for a published form, or null when the
 * inputs cannot produce one. Callers must handle null rather than falling back
 * to a browser-derived origin.
 */
export function buildPublicFormUrl(options: {
  baseUrl: string;
  slug: string;
}): null | string {
  const slug = options.slug.trim();
  const baseUrl = options.baseUrl.trim();

  if (!slug || !baseUrl) return null;

  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return null;
  }

  // A share link is pasted into announcements and emails. Anything that is not
  // ordinary web traffic has no business being handed to a member, and
  // `javascript:` parses perfectly well as a URL.
  if (base.protocol !== "https:" && base.protocol !== "http:") return null;

  try {
    // `origin` discards any path on the configured base, matching what
    // getAppBaseUrl() already normalises to.
    return new URL(
      `${PUBLIC_FORM_PATH_PREFIX}/${encodeURIComponent(slug)}`,
      base.origin
    ).toString();
  } catch {
    return null;
  }
}

/**
 * Compact display form. The scheme carries no information for an operator
 * checking which address a form lives at, and dropping it keeps the URL
 * readable inside a narrow sidebar card.
 */
export function formatPublicFormUrlForDisplay(url: string) {
  return url.replace(/^https?:\/\//, "");
}

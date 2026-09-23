const AUTHENTICATED_REDIRECTS = new Map([
  ["/portal/login", "/portal/dashboard"],
  ["/portal/access-pending", "/portal/dashboard"],
  ["/profile", "/portal/profile"],
  ["/profile/edit", "/portal/profile/edit"],
  ["/profile/change-password", "/portal/profile/change-password"],
]);

export function normalizePortalRoute(value, baseUrl) {
  const url = new URL(value, baseUrl);
  return `${url.pathname}${url.search}`;
}

export function expectedPortalLanding(route, isAuthenticated, baseUrl) {
  const normalized = normalizePortalRoute(route, baseUrl);
  const pathname = new URL(normalized, baseUrl).pathname;

  if (isAuthenticated) {
    return AUTHENTICATED_REDIRECTS.get(pathname) || normalized;
  }

  if (pathname === "/portal/login") {
    return normalized;
  }

  if (
    pathname === "/portal" ||
    pathname.startsWith("/portal/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/")
  ) {
    return `/portal/login?next=${encodeURIComponent(normalized)}`;
  }

  return normalized;
}

export function isExpectedPortalLanding({
  baseUrl,
  isAuthenticated,
  landedRoute,
  requestedRoute,
}) {
  return (
    normalizePortalRoute(landedRoute, baseUrl) ===
    expectedPortalLanding(requestedRoute, isAuthenticated, baseUrl)
  );
}

export function hasPortalAuditFailures({
  findings = [],
  consoleErrors = [],
  pageErrors = [],
}) {
  return (
    findings.length > 0 || consoleErrors.length > 0 || pageErrors.length > 0
  );
}

export function isIgnorablePortalConsoleError({ text = "", url = "" }) {
  if (text.includes("favicon.ico") || url.endsWith("/favicon.ico")) {
    return true;
  }

  return (
    text === "%c%d font-size:0;color:transparent NaN" &&
    url.startsWith("https://challenges.cloudflare.com/")
  );
}

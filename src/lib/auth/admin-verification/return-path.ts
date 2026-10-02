const destinations = new Set(["/admin/dashboard", "/admin/admin-profiles", "/admin/membership", "/admin/settings/security", "/admin/system-health", "/admin/retention"]);
export function safeAdminVerificationReturnPath(value?: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/admin/dashboard";
  try {
    const url = new URL(value, "https://admin-return.invalid");
    return url.origin === "https://admin-return.invalid" && destinations.has(url.pathname)
      ? `${url.pathname}${url.search}${url.hash}` : "/admin/dashboard";
  } catch { return "/admin/dashboard"; }
}

const SIGN_OUT_REDIRECTS = new Set(["/admin/login", "/portal/login"]);

export function resolveSignOutRedirect(value: string) {
  return SIGN_OUT_REDIRECTS.has(value) ? value : "/portal/login";
}

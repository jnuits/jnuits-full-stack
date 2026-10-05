import { randomBytes } from "node:crypto";
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { buildContentSecurityPolicy } from "@/lib/security/http-headers";

function isDocumentRequest(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!["GET", "HEAD"].includes(request.method) || path === "/api" || path.startsWith("/api/") || path.startsWith("/_next/") || path.startsWith("/images/") || ["/sitemap.xml", "/robots.txt", "/favicon.ico"].includes(path)) return false;
  if (request.headers.get("rsc") === "1" || request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch") return false;
  const accept = request.headers.get("accept");
  return !accept || accept.includes("text/html") || accept === "*/*" || request.headers.get("sec-fetch-dest") === "document";
}

export async function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete("x-nonce");
  headers.delete("content-security-policy");
  let csp: string | undefined;
  if (isDocumentRequest(request)) {
    const nonce = randomBytes(24).toString("base64");
    csp = buildContentSecurityPolicy({ nonce });
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
  }
  const response = await updateSession(request, headers);
  if (csp) {
    response.headers.set("Content-Security-Policy", csp);
    // Nonced HTML must not be shared or reused across document requests.
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/).*)",
  ],
};

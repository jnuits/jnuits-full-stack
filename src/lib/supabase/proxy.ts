import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { checkAdminMFA } from "@/lib/auth/mfa";
import type { Database } from "@/lib/db/types";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/config";

const adminMfaExemptPaths = new Set([
  "/admin/login",
  "/admin/mfa/setup",
  "/admin/mfa/challenge",
]);
const publicAuthPaths = new Set(["/login", "/admin/login", "/portal/login"]);
const protectedPrefixes = ["/admin", "/portal", "/profile"];

type RBACClaims = {
  adminRole: null | string;
  portalRole: null | string;
};

function isProtectedPath(pathname: string) {
  if (publicAuthPaths.has(pathname)) {
    return false;
  }

  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asClaimString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function extractRBACClaims(claims: Record<string, unknown> | null): RBACClaims {
  return {
    adminRole: asClaimString(claims?.jnuits_admin_role),
    portalRole: asClaimString(claims?.jnuits_portal_role),
  };
}

async function resolveDatabaseClaims(
  supabase: ReturnType<typeof createServerClient<Database>>,
  userId: string
): Promise<RBACClaims> {
  if (!userId) {
    return {
      adminRole: null,
      portalRole: null,
    };
  }

  const { data } = await (supabase as never as {
    rpc: (
      fn: "current_rbac_claims_snapshot"
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  }).rpc("current_rbac_claims_snapshot");
  const snapshot = asRecord(data);

  return {
    adminRole: asClaimString(snapshot.jnuits_admin_role),
    portalRole: asClaimString(snapshot.jnuits_portal_role),
  };
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isPortalPath(pathname: string) {
  return (
    pathname === "/portal" ||
    pathname.startsWith("/portal/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/")
  );
}

function copyCookies(
  source: NextResponse,
  target: NextResponse
): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie.name, cookie.value, cookie);
  });

  return target;
}

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
  searchParams?: Record<string, string>
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  redirectUrl.search = "";

  Object.entries(searchParams || {}).forEach(([key, value]) => {
    redirectUrl.searchParams.set(key, value);
  });

  return copyCookies(response, NextResponse.redirect(redirectUrl));
}

async function resolveAdminMfaRedirect(
  supabase: ReturnType<typeof createServerClient<Database>>,
  pathname: string
) {
  if (!isAdminPath(pathname) || adminMfaExemptPaths.has(pathname)) {
    return null;
  }

  const mfaState = await checkAdminMFA(supabase);
  return mfaState.ok ? null : mfaState.redirectTo;
}

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-jnuits-return-to",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient<Database>(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase.auth.getClaims();
  const claims = (data?.claims || null) as Record<string, unknown> | null;
  const hasSession = Boolean(user);
  const claimSnapshot = extractRBACClaims(claims);
  const databaseSnapshot =
    hasSession && user && (!claimSnapshot.adminRole || !claimSnapshot.portalRole)
      ? await resolveDatabaseClaims(supabase, user.id)
      : { adminRole: null, portalRole: null };
  const adminRole = claimSnapshot.adminRole || databaseSnapshot.adminRole;
  const portalRole = claimSnapshot.portalRole || databaseSnapshot.portalRole;

  if (!hasSession && isProtectedPath(pathname)) {
    return redirectWithCookies(
      request,
      supabaseResponse,
      isAdminPath(pathname) ? "/admin/login" : "/portal/login",
      { next: `${pathname}${request.nextUrl.search}` }
    );
  }

  if (hasSession && pathname === "/admin/login") {
    if (adminRole) {
      const mfaRedirect = await resolveAdminMfaRedirect(
        supabase,
        "/admin/dashboard"
      );

      return redirectWithCookies(
        request,
        supabaseResponse,
        mfaRedirect || "/admin/dashboard"
      );
    }

    return redirectWithCookies(
      request,
      supabaseResponse,
      portalRole ? "/portal/dashboard" : "/admin/login"
    );
  }

  if (hasSession && pathname === "/portal/login") {
    if (portalRole) {
      return redirectWithCookies(request, supabaseResponse, "/portal/dashboard");
    }

    return redirectWithCookies(
      request,
      supabaseResponse,
      adminRole ? "/admin/dashboard" : "/portal/login"
    );
  }

  if (hasSession && isAdminPath(pathname) && !adminRole) {
    return redirectWithCookies(
      request,
      supabaseResponse,
      portalRole ? "/portal/dashboard" : "/admin/login"
    );
  }

  if (hasSession && isPortalPath(pathname) && !portalRole) {
    return redirectWithCookies(
      request,
      supabaseResponse,
      adminRole ? "/admin/dashboard" : "/portal/login"
    );
  }

  if (hasSession && adminRole) {
    const mfaRedirect = await resolveAdminMfaRedirect(supabase, pathname);

    if (mfaRedirect) {
      return redirectWithCookies(request, supabaseResponse, mfaRedirect);
    }
  }

  return supabaseResponse;
}

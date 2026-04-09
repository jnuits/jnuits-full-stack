import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthContext = {
  user: null | {
    id: string;
    email: string | null;
    aal: string | null;
    rawClaims: Record<string, unknown>;
  };
  roles: string[];
};

const ADMIN_ROLES = new Set(["super_admin", "admin", "moderator"]);
const OPERATOR_ROLES = new Set([
  "super_admin",
  "admin",
  "moderator",
  "content_editor",
  "committee_author",
]);

export function resolveSafeNextPath(
  nextPath: null | string | undefined,
  fallbackPath = "/portal"
) {
  if (!nextPath) {
    return fallbackPath;
  }

  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return fallbackPath;
  }

  return nextPath;
}

export function hasOperatorRole(roles: string[]) {
  return roles.some((role) => OPERATOR_ROLES.has(role));
}

async function resolveRequestNextPath(fallbackPath: string) {
  const requestHeaders = await headers();
  const requestedPath = requestHeaders.get("x-jnuits-return-to");
  const safePath = resolveSafeNextPath(requestedPath, fallbackPath);

  if (
    fallbackPath !== "/" &&
    !safePath.startsWith(fallbackPath) &&
    safePath !== fallbackPath
  ) {
    return fallbackPath;
  }

  return safePath;
}

export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;

  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  const email =
    typeof claims?.email === "string"
      ? claims.email
      : typeof claims?.["email"] === "string"
        ? String(claims["email"])
        : null;
  const aal =
    typeof claims?.aal === "string"
      ? claims.aal
      : typeof claims?.["aal"] === "string"
        ? String(claims["aal"])
        : null;

  if (!userId) {
    return {
      user: null,
      roles: [],
    };
  }

  const { data: roleRows } = await supabase
    .from("rbac_user_platform_roles")
    .select("role_id, rbac_platform_roles(code)")
    .eq("user_id", userId)
    .is("revoked_at", null);

  const roles = (roleRows || [])
    .map((row) => {
      const roleRecord = (
        row as {
          rbac_platform_roles?:
            | { code?: string | null }
            | { code?: string | null }[]
            | null;
        }
      ).rbac_platform_roles as
        | { code?: string | null }
        | { code?: string | null }[]
        | null;

      if (Array.isArray(roleRecord)) {
        return typeof roleRecord[0]?.code === "string" ? roleRecord[0].code : null;
      }

      return typeof roleRecord?.code === "string" ? roleRecord.code : null;
    })
    .filter((value): value is string => Boolean(value));

  return {
    user: {
      id: userId,
      email,
      aal,
      rawClaims: claims as Record<string, unknown>,
    },
    roles,
  };
}

export async function requireAuthenticatedUser(options?: {
  fallbackPath?: string;
}) {
  const fallbackPath = options?.fallbackPath || "/portal";
  const auth = await getAuthContext();

  if (!auth.user) {
    const nextPath = await resolveRequestNextPath(fallbackPath);
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return auth;
}

export async function requireAdminUser(options?: {
  fallbackPath?: string;
}) {
  const auth = await requireAuthenticatedUser({
    fallbackPath: options?.fallbackPath || "/admin",
  });

  if (!auth.roles.some((role) => ADMIN_ROLES.has(role))) {
    redirect("/portal");
  }

  return auth;
}

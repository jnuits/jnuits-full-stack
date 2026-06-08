import "server-only";

import { NextResponse } from "next/server";
import {
  getAuthContext,
  hasPermission,
  type AuthContext,
} from "@/lib/auth/session";
import type { AdminPermission } from "@/lib/admin/access";

type AuthenticatedAdminContext = AuthContext & {
  user: NonNullable<AuthContext["user"]>;
};

type AdminApiPermissionResult =
  | { auth: AuthenticatedAdminContext; response?: never }
  | { auth?: never; response: NextResponse };

export async function requireAdminApiPermission(
  permission: AdminPermission,
  options: {
    forbiddenMessage?: string;
    unauthenticatedMessage?: string;
  } = {}
): Promise<AdminApiPermissionResult> {
  const auth = await getAuthContext();

  if (!auth.user?.id) {
    return {
      response: NextResponse.json(
        {
          message:
            options.unauthenticatedMessage ||
            "Sign in before using this admin endpoint.",
        },
        { status: 401 }
      ),
    };
  }

  const allowed = await hasPermission(permission);

  if (!allowed) {
    return {
      response: NextResponse.json(
        {
          message:
            options.forbiddenMessage ||
            "You do not have permission to perform this admin action.",
        },
        { status: 403 }
      ),
    };
  }

  return { auth: { ...auth, user: auth.user } };
}

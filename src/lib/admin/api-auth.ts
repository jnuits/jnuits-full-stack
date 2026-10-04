import "server-only";

import { NextResponse } from "next/server";
import {
  getAuthContext,
  hasAdminRole,
  hasPermission,
  type AuthContext,
} from "@/lib/auth/session";
import { loadAdminLifecycleAccessState } from "@/lib/auth/admin-lifecycle";
import { checkAdminMFA } from "@/lib/auth/mfa";
import { createClient } from "@/lib/supabase/server";
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
    requireAal2?: boolean;
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

  if (!hasAdminRole(auth.roles)) {
    return {
      response: NextResponse.json(
        { message: "Active admin access is required for this action." },
        { status: 403 }
      ),
    };
  }

  const lifecycle = await loadAdminLifecycleAccessState(auth.user.id);
  if (lifecycle !== "active") {
    return {
      response: NextResponse.json(
        { message: "Active admin access is required for this action." },
        { status: 403 }
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

  try {
    // Every API must honor workspace entry policy. Optional entry enforcement
    // never substitutes for a sensitive operation's unconditional native AAL2.
    const mfaState = await checkAdminMFA(await createClient());
    const requiresNativeAal2 = options.requireAal2 || mfaState.enforced;
    if (
      !mfaState.ok ||
      mfaState.error ||
      (requiresNativeAal2 &&
        (mfaState.currentLevel !== "aal2" || mfaState.nextLevel !== "aal2"))
    ) {
      return {
        response: NextResponse.json(
          { message: "Complete multi-factor verification before this action." },
          { status: 403 }
        ),
      };
    }
  } catch {
    return {
      response: NextResponse.json(
        { message: "Admin security policy could not be verified. Try again later." },
        { status: 503 }
      ),
    };
  }


  return { auth: { ...auth, user: auth.user } };
}

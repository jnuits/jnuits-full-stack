import "server-only";
import {requireAdminPermission,requireAdminUser} from "@/lib/auth/session";
import {recordCurrentAdminWorkspaceAccess} from "./capture-server";
import {authorizeAdminRead} from "@/lib/auth/admin-verification/read-boundary";

/** Page guards run during each server page render, including client navigation.
 * Actions and APIs retain the original guards and never manufacture page visits. */
export async function requireAdminPagePermission(...args:Parameters<typeof requireAdminPermission>) {
  const auth=await requireAdminPermission(...args);
  await recordCurrentAdminWorkspaceAccess();
  return auth;
}

export async function requireAdminPageUser(...args:Parameters<typeof requireAdminUser>) {
  const auth=await requireAdminUser(...args);
  await recordCurrentAdminWorkspaceAccess();
  return auth;
}

export async function authorizeAdminPageRead(...args:Parameters<typeof authorizeAdminRead>) {
  const result=await authorizeAdminRead(...args);
  if(result.ok)await recordCurrentAdminWorkspaceAccess();
  return result;
}

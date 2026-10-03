import "server-only";
import type { AdminOperation } from "./types";
const names = {
  "admin.security.read": "jnuits-admin-security-read",
  "admin.system_health.read": "jnuits-admin-health-read",
  "admin.retention.read": "jnuits-admin-retention-read",
} as const;
export function getAdminReadProofCookieName(operation: AdminOperation): string | null {
  return Object.hasOwn(names, operation) ? names[operation as keyof typeof names] : null;
}

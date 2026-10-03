export const ADMIN_INVITATION_ACCEPT_PATH = "/admin/invite/accept";

export function isAdminInvitationAcceptNextPath(value: string | null | undefined) {
  return value === ADMIN_INVITATION_ACCEPT_PATH;
}

export function isAdminInvitationAcceptPath(pathname: string) {
  return pathname === ADMIN_INVITATION_ACCEPT_PATH;
}

export type AdminInvitationAcceptanceState =
  | "claim-required"
  | "expired"
  | "reissue-required"
  | "retry"
  | "wrong-account";

export function buildAdminInvitationAcceptPath(options?: {
  claimed?: boolean;
  state?: AdminInvitationAcceptanceState;
}) {
  const params = new URLSearchParams();

  if (options?.claimed) params.set("claimed", "1");
  if (options?.state) params.set("state", options.state);

  const query = params.toString();
  return query
    ? `${ADMIN_INVITATION_ACCEPT_PATH}?${query}`
    : ADMIN_INVITATION_ACCEPT_PATH;
}

export function resolvePostClaimDestination(hasPendingAdminInvitation: boolean) {
  return hasPendingAdminInvitation
    ? buildAdminInvitationAcceptPath({ claimed: true })
    : "/portal/dashboard?claimed=1";
}

export function resolveAdminInvitationAcceptanceState(
  error: unknown,
): AdminInvitationAcceptanceState {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  if (/claim the linked member profile/i.test(message)) {
    return "claim-required";
  }
  if (/requires authorized reissuance/i.test(message)) return "reissue-required";

  if (/invitation has expired|invitation.*expired/i.test(message)) {
    return "expired";
  }

  if (/different signed-in user|belongs to a different signed-in user/i.test(message)) {
    return "wrong-account";
  }

  return "retry";
}

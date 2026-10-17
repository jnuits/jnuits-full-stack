export type AdminNoticeKind =
  | "password_changed"
  | "invitation_created"
  | "invitation_accepted"
  | "invitation_revoked"
  | "access_changed"
  | "access_removed"
  | "mfa_changed";

export type AdminSecurityNoticeIntent = {
  eventKey: string;
  kind: AdminNoticeKind;
  title: string;
  summary: string;
  severity: "info" | "warning" | "critical";
  actorUserId: string;
  affectedUserId: string | null;
  occurredAt: string;
  href: string;
};

/** Trusted current-state inputs, never a browser-selected recipient or role. */
export type AdminPeerRecipient = {
  userId: string;
  activeAdmin: boolean;
  canReadAudit: boolean;
  emailVerified: boolean;
  emailSuppressed: boolean;
  securityEmailOptIn: boolean;
};

export type AdminDeliveryState =
  | "pending" | "sending" | "accepted" | "delivered"
  | "suppressed" | "failed" | "uncertain";

export type AdminNotificationJobHealth = {
  state:"current"|"attention"|"delayed"|"unavailable";
  lastFinishedAt:string|null;lastSuccessfulAt:string|null;
  backlog:boolean;operatorAttentionCount:number;
};

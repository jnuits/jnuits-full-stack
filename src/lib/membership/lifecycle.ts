export type MembershipAccessMode = "mutable" | "restricted" | "blocked";

export type CurrentMembershipPathStatus =
  | "open"
  | "departure_requested"
  | "closed_appealable"
  | "closed_final";

export type MembershipAccessSnapshot = {
  lifecycleStatus: string | null;
  memberType?: string | null;
  portalAccessStatus: string | null;
  currentMembershipPathStatus: string | null;
};

/** Projects authoritative database states; never changes lifecycle or security. */
export function resolveMembershipAccessMode(snapshot: MembershipAccessSnapshot): MembershipAccessMode {
  if (snapshot.portalAccessStatus !== "active") return "blocked";
  if (snapshot.lifecycleStatus === "alumni") return "mutable";
  if (snapshot.lifecycleStatus !== "current" && snapshot.lifecycleStatus !== "former") return "blocked";

  switch (snapshot.currentMembershipPathStatus) {
    case "open":
      return snapshot.lifecycleStatus === "current" ? "mutable" : "restricted";
    case "departure_requested":
    case "closed_appealable":
    case "closed_final":
      return "restricted";
    default:
      return "blocked";
  }
}

import { normalizeJnuitsIdForCreation } from "@/lib/members/jnuits-id";

export type AlumniIdentity = {
  email: string;
  jnuitsId: null | string;
};

export type AlumniMemberMatch<T extends { id: string }> =
  | { kind: "conflict"; member: null }
  | { kind: "create"; member: null }
  | { kind: "existing"; member: T };

export function normalizeAlumniIdentity(input: {
  email: string;
  jnuitsId?: null | string;
}): AlumniIdentity {
  const rawJnuitsId = input.jnuitsId?.trim() || "";

  return {
    email: input.email.trim().toLowerCase(),
    jnuitsId: normalizeJnuitsIdForCreation(rawJnuitsId) || rawJnuitsId.toUpperCase() || null,
  };
}

export function resolveAlumniMemberMatch<T extends { id: string }>(
  memberByEmail: T | null,
  memberByJnuitsId: T | null,
): AlumniMemberMatch<T> {
  if (memberByEmail && memberByJnuitsId && memberByEmail.id !== memberByJnuitsId.id) {
    return { kind: "conflict", member: null };
  }

  const member = memberByEmail || memberByJnuitsId;
  return member ? { kind: "existing", member } : { kind: "create", member: null };
}
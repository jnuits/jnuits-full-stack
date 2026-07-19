import { describe, expect, it } from "vitest";

import {
  normalizeAlumniIdentity,
  resolveAlumniMemberMatch,
} from "@/lib/forms/alumni-identity";

describe("alumni identity matching", () => {
  it("normalizes email and a valid JnUITS identifier before lookup", () => {
    expect(normalizeAlumniIdentity({ email: " Alumni@Example.test ", jnuitsId: "jnuits-2026001" })).toEqual({
      email: "alumni@example.test",
      jnuitsId: "JNUITS-2026001",
    });
  });

  it("reuses one matching member and refuses cross-identity matches", () => {
    const sameMember = { id: "member-1" };

    expect(resolveAlumniMemberMatch(sameMember, sameMember)).toEqual({
      kind: "existing",
      member: sameMember,
    });
    expect(resolveAlumniMemberMatch({ id: "member-1" }, { id: "member-2" })).toEqual({
      kind: "conflict",
      member: null,
    });
    expect(resolveAlumniMemberMatch(null, null)).toEqual({ kind: "create", member: null });
  });
});
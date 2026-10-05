import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheMocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: cacheMocks.revalidatePath,
}));

import { revalidatePublicCommitteeProjection } from "./revalidation";

function readProjectSource(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
    "utf8"
  );
}

function sourceSection(source: string, start: string, end?: string) {
  const startIndex = source.indexOf(start);
  expect(startIndex, `${start} should exist`).toBeGreaterThanOrEqual(0);
  const endIndex = end ? source.indexOf(end, startIndex + start.length) : -1;
  return source.slice(startIndex, endIndex >= 0 ? endIndex : undefined);
}

describe("public committee projection revalidation", () => {
  beforeEach(() => {
    cacheMocks.revalidatePath.mockClear();
  });

  it("invalidates the public committee and member route families", () => {
    revalidatePublicCommitteeProjection();

    expect(cacheMocks.revalidatePath.mock.calls).toEqual([
      ["/committee"],
      ["/committee/[termSlug]", "page"],
      ["/members"],
      ["/members/[jnuitsId]", "page"],
    ]);
  });

  it("uses the shared helper after successful committee mutations", () => {
    const source = readProjectSource("app/admin/committee/actions.ts");

    expect(source).toContain("revalidatePublicCommitteeProjection");
    expect(source).not.toContain('revalidatePath("/committee")');
  });

  it("revalidates public routes only when an onboarding draft is published", () => {
    const source = readProjectSource("app/admin/onboarding/actions.ts");
    const createDraft = sourceSection(
      source,
      "export async function createOnboardingDraftAction",
      "export async function getOnboardingDraftAction"
    );
    const publishDraft = sourceSection(
      source,
      "export async function publishOnboardingDraftAction",
      "export async function searchOnboardingMembersAction"
    );

    expect(createDraft).not.toContain("revalidatePublicCommitteeProjection");
    expect(publishDraft).toContain("revalidatePublicCommitteeProjection();");
  });

  it("revalidates lifecycle and approved profile mutations", () => {
    const membership = readProjectSource("app/admin/membership/actions.ts");
    const lifecycle = sourceSection(
      membership,
      "export async function updateMemberLifecycle(",
      "export async function updateMemberLifecycleAction"
    );
    const moderation = readProjectSource(
      "app/admin/membership/moderation-actions.ts"
    );
    const workplaceApproval = sourceSection(
      moderation,
      "async function moderateLegacyWorkplaceRequest",
      "export async function approveWorkplaceUpdateRequest"
    );
    const profileApproval = sourceSection(
      moderation,
      "export async function approveProfileChangeRequest",
      "export async function rejectProfileChangeRequest"
    );

    expect(lifecycle).toContain("revalidatePublicCommitteeProjection();");
    expect(workplaceApproval).toContain("revalidatePublicCommitteeProjection();");
    expect(profileApproval.match(/revalidatePublicCommitteeProjection\(\);/g)).toHaveLength(2);
  });

  it("revalidates direct edits and member avatars without coupling admin avatars", () => {
    const directEdit = readProjectSource("app/api/profile/direct/route.ts");
    const avatar = readProjectSource("app/api/profile/avatar/complete/route.ts");

    expect(directEdit).toContain("revalidatePublicCommitteeProjection();");
    expect(avatar).toMatch(
      /if \(authorization\.target\.targetType === "member"\) \{\s+revalidatePublicCommitteeProjection\(\);\s+\}/
    );
  });
});

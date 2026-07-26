import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  canAccessFormStudioKind,
  formStudioKindFilter,
  getFormStudioKindScope,
} from "@/lib/forms/form-studio-access";

const PLATFORM_MIGRATION = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260718131228_create_versioned_form_platform.sql"),
  "utf8"
);

const PII_PERMISSIONS = ["admin.forms.review", "admin.forms.export"] as const;
const FORM_TABLES = [
  "form_definitions",
  "form_versions",
  "form_submissions",
  "form_submission_assets",
  "form_export_jobs",
  "form_archive_jobs",
  "alumni_onboarding_cases",
] as const;

describe("Form Studio kind scoping", () => {
  it("confines content admins to event registration forms", () => {
    const roles = ["content_admin"];

    expect(getFormStudioKindScope(roles)).toBe("event_registration");
    expect(canAccessFormStudioKind(roles, "event_registration")).toBe(true);
    expect(canAccessFormStudioKind(roles, "membership_application")).toBe(false);
    expect(canAccessFormStudioKind(roles, "alumni_onboarding")).toBe(false);
  });

  it("grants every kind only to admin and super admin", () => {
    for (const roles of [["admin"], ["super_admin"]]) {
      expect(getFormStudioKindScope(roles)).toBe("all");
      for (const kind of [
        "event_registration",
        "membership_application",
        "alumni_onboarding",
      ] as const) {
        expect(canAccessFormStudioKind(roles, kind)).toBe(true);
      }
    }
  });

  it("denies every kind to roles outside the studio", () => {
    for (const roles of [[], ["member"], ["alumni"], ["unknown_role"], ["Admin"], ["ADMIN"]]) {
      expect(getFormStudioKindScope(roles)).toBeNull();
      for (const kind of [
        "event_registration",
        "membership_application",
        "alumni_onboarding",
      ] as const) {
        expect(canAccessFormStudioKind(roles, kind)).toBe(false);
      }
    }
  });

  it("resolves additive role sets to the strongest scope", () => {
    expect(getFormStudioKindScope(["content_admin", "admin"])).toBe("all");
    expect(getFormStudioKindScope(["member", "content_admin"])).toBe("event_registration");
    expect(getFormStudioKindScope(["member", "alumni"])).toBeNull();
  });

  it("forces a server-side kind filter for content admins only", () => {
    expect(formStudioKindFilter(["content_admin"])).toBe("event_registration");
    expect(formStudioKindFilter(["admin"])).toBeUndefined();
    expect(formStudioKindFilter(["super_admin"])).toBeUndefined();
    // No scope means the caller is rejected before listing, so an undefined
    // filter here must never be read as "return everything".
    expect(formStudioKindFilter(["member"])).toBeUndefined();
    expect(getFormStudioKindScope(["member"])).toBeNull();
  });
});

describe("membership and alumni PII denial", () => {
  it("never grants content admins review or export access", () => {
    // This is the control that keeps content admins away from member and alumni
    // PII. The export route intentionally has no kind check, because no role
    // limited to event forms can hold the permission that reaches it.
    for (const permission of PII_PERMISSIONS) {
      expect(PLATFORM_MIGRATION).not.toContain(`('content_admin', '${permission}')`);
    }

    expect(PLATFORM_MIGRATION).toContain("('content_admin', 'cms.forms.manage')");
    expect(PLATFORM_MIGRATION).toContain("('content_admin', 'cms.forms.publish')");
  });

  it("grants review and export exclusively to admin and super admin", () => {
    for (const permission of PII_PERMISSIONS) {
      const escaped = permission.replace(/\./g, "\\.");
      const grants = PLATFORM_MIGRATION.match(
        new RegExp(`\\('([a-z_]+)', '${escaped}'\\)`, "g")
      );

      expect(grants?.slice().sort()).toEqual([
        `('admin', '${permission}')`,
        `('super_admin', '${permission}')`,
      ]);
    }
  });
});

describe("form table grants and RLS", () => {
  it("keeps every form table server-only with row level security enabled", () => {
    for (const table of FORM_TABLES) {
      expect(PLATFORM_MIGRATION).toContain(
        `alter table public.${table} enable row level security`
      );
      expect(PLATFORM_MIGRATION).toContain(
        `revoke all on table public.${table} from public, anon, authenticated`
      );
      expect(PLATFORM_MIGRATION).toContain(
        `grant select, insert, update on table public.${table} to service_role`
      );
    }
  });

  it("grants no direct delete on any form table", () => {
    expect(PLATFORM_MIGRATION).not.toMatch(/grant[^;]*delete[^;]*on table public\.form_/i);
  });
});

function sourceFiles(directory: string): string[] {
  const root = resolve(process.cwd(), directory);
  const found: string[] = [];

  for (const entry of readdirSync(root)) {
    const path = join(root, entry);

    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(join(directory, entry)));
      continue;
    }

    if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      found.push(path);
    }
  }

  return found;
}

describe("authorization metadata trust", () => {
  it("never derives roles or permissions from user-editable metadata", () => {
    const files = [...sourceFiles("src/lib/auth"), ...sourceFiles("src/lib/admin")];

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      expect(readFileSync(file, "utf8")).not.toContain("user_metadata");
    }
  });
});

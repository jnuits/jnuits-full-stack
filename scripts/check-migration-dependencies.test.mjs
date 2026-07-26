import { describe, expect, it } from "vitest";

import {
  analyzeMigrations,
  BOOTSTRAP_FUNCTIONS,
  extractDefinedFunctions,
  extractImmediateReferences,
  stripFunctionBodies,
} from "./check-migration-dependencies.mjs";

function migration(filename, sql) {
  return { filename, sql };
}

describe("migration dependency analysis", () => {
  it("accepts a chain that defines a function before executing it", () => {
    const findings = analyzeMigrations([
      migration(
        "20260101000000_create_helper.sql",
        "create or replace function public.helper() returns void as $$ begin end $$ language plpgsql;"
      ),
      migration("20260102000000_use_helper.sql", "select public.helper();"),
    ]);

    expect(findings).toEqual([]);
  });

  it("fails a migration that executes a function no earlier migration creates", () => {
    const findings = analyzeMigrations([
      migration("20260101000000_use_missing.sql", "select public.never_created();"),
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe("forward-reference");
    expect(findings[0].message).toContain("public.never_created()");
  });

  it("reproduces the rls_auto_enable gap and allows it only via the bootstrap list", () => {
    const chain = [
      migration(
        "20260608093000_admin_permission_policy_hardening.sql",
        "select public.rls_auto_enable();"
      ),
    ];

    expect(BOOTSTRAP_FUNCTIONS.has("rls_auto_enable")).toBe(true);
    expect(analyzeMigrations(chain)).toEqual([]);

    const withoutAllowlist = analyzeMigrations([
      migration("20260608093000_admin_permission_policy_hardening.sql", "select public.some_other_missing_helper();"),
    ]);
    expect(withoutAllowlist[0].kind).toBe("forward-reference");
  });

  it("ignores references inside a function body, which resolve at call time", () => {
    const findings = analyzeMigrations([
      migration(
        "20260101000000_deferred_reference.sql",
        `create or replace function public.outer_fn() returns void as $body$
           begin
             perform public.defined_later();
           end
         $body$ language plpgsql;`
      ),
    ]);

    expect(findings).toEqual([]);
  });

  it("still flags an immediate reference in a DO block", () => {
    const findings = analyzeMigrations([
      migration(
        "20260101000000_do_block.sql",
        "do $$ begin perform public.missing_now(); end $$;"
      ),
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe("forward-reference");
  });

  it("detects duplicate versions", () => {
    const findings = analyzeMigrations([
      migration("20260101000000_first.sql", "select 1;"),
      migration("20260101000000_second.sql", "select 1;"),
    ]);

    expect(findings.some((finding) => finding.kind === "duplicate-version")).toBe(true);
  });

  it("detects a reordered chain", () => {
    const findings = analyzeMigrations([
      migration("20260201000000_later.sql", "select 1;"),
      migration("20260101000000_earlier.sql", "select 1;"),
    ]);

    expect(findings.some((finding) => finding.kind === "order")).toBe(true);
  });

  it("rejects a malformed migration filename", () => {
    const findings = analyzeMigrations([
      migration("not-a-migration.sql", "select 1;"),
    ]);

    expect(findings[0].kind).toBe("filename");
  });

  it("detects duplicate logical names", () => {
    const findings = analyzeMigrations([
      migration("20260101000000_same_name.sql", "select 1;"),
      migration("20260102000000_same_name.sql", "select 1;"),
    ]);

    expect(findings.some((finding) => finding.kind === "duplicate-name")).toBe(true);
  });
});

describe("sql parsing helpers", () => {
  it("removes dollar-quoted function bodies with arbitrary tags", () => {
    const stripped = stripFunctionBodies(
      "create function public.a() as $tag$ perform public.hidden(); $tag$ language plpgsql; select public.visible();"
    );

    expect(stripped).not.toContain("public.hidden()");
    expect(stripped).toContain("public.visible()");
  });

  it("ignores commented-out references", () => {
    expect(extractImmediateReferences("-- select public.ignored();\nselect 1;").size).toBe(0);
    expect(extractImmediateReferences("/* select public.ignored(); */ select 1;").size).toBe(0);
  });

  it("extracts definitions with and without the public schema prefix", () => {
    expect(extractDefinedFunctions("create function public.with_prefix() returns void")).toContain(
      "with_prefix"
    );
    expect(extractDefinedFunctions("create or replace function without_prefix() returns void")).toContain(
      "without_prefix"
    );
  });
});

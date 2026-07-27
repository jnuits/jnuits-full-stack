import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  analyzeMigrations,
  BOOTSTRAP_FUNCTIONS,
  blankNonCode,
  extractDefinedFunctions,
  extractImmediateReferences,
  precedingWord,
  stripFunctionBodies,
} from "./check-migration-dependencies.mjs";

function migration(filename, sql) {
  return { filename, sql };
}

function analyzeOne(sql) {
  return analyzeMigrations([migration("20260101000000_subject.sql", sql)]);
}

function forwardReferences(sql) {
  return analyzeOne(sql).filter((finding) => finding.kind === "forward-reference");
}

describe("DDL is not mistaken for a function call", () => {
  // Every case below was reported as a forward reference by the first version
  // of this checker, which produced 198 findings against the real chain.
  const ddlCases = [
    ["create table", "create table public.audit_events (\n  id uuid primary key\n);"],
    ["create table if not exists", "create table if not exists public.members (\n  id uuid\n);"],
    ["create index on", "create index members_email_idx on public.members (email);"],
    ["create unique index on", "create unique index x on public.members (email) where deleted_at is null;"],
    ["foreign key reference", "create table public.a (\n  member_id uuid references public.members (id)\n);"],
    ["insert into", "insert into public.events (id, title) values (gen_random_uuid(), 'x');"],
    ["revoke on function", "revoke all on function public.purge_retention_job(text, uuid, uuid) from anon;"],
    ["grant execute on function", "grant execute on function public.is_admin_totp_enforced() to authenticated;"],
    ["revoke execute on function", "revoke execute on function public.current_admin_role() from anon;"],
    ["drop function if exists", "drop function if exists public.legacy_helper(uuid);"],
    ["comment on function", "comment on function public.rls_auto_enable() is 'x';"],
    ["alter table", "alter table public.profile_update_requests (id);"],
    ["create trigger on", "create trigger t after insert on public.members (id);"],
    ["create view", "create view public.public_certificates (full_name) as select 1;"],
    ["materialized view", "create materialized view public.stats (n) as select 1;"],
    ["truncate", "truncate public.audit_events (cascade);"],
  ];

  for (const [label, sql] of ddlCases) {
    it(`ignores ${label}`, () => {
      expect(forwardReferences(sql)).toEqual([]);
    });
  }

  it("produces no findings for a realistic migration mixing all of them", () => {
    const sql = `
      create table if not exists public.form_upload_sessions (
        id uuid primary key default gen_random_uuid(),
        form_definition_id uuid not null references public.form_definitions (id),
        created_at timestamptz not null default now()
      );

      create index form_upload_sessions_form_idx
        on public.form_upload_sessions (form_definition_id);

      alter table public.form_upload_sessions enable row level security;

      revoke all on table public.form_upload_sessions from public, anon, authenticated;
      grant select, insert on table public.form_upload_sessions to service_role;

      revoke all on function public.consume_form_upload_session(uuid, uuid, uuid, text)
        from public, anon, authenticated;
    `;

    expect(analyzeOne(sql)).toEqual([]);
  });
});

describe("real invocations are still detected", () => {
  it("flags a bare select of an undefined function", () => {
    const findings = forwardReferences("select public.never_created();");

    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("public.never_created()");
  });

  it("flags perform inside a DO block", () => {
    expect(forwardReferences("do $$ begin perform public.missing_now(); end $$;")).toHaveLength(1);
  });

  it("flags a call used as a column default", () => {
    const findings = forwardReferences(
      "create table public.t (\n  id text default public.make_id()\n);"
    );

    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("public.make_id()");
  });

  it("flags a call inside an RLS policy expression", () => {
    const findings = forwardReferences(
      "create policy p on public.members for select using (public.has_permission('x'));"
    );

    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("public.has_permission()");
  });

  it("flags a table function in a from clause", () => {
    expect(forwardReferences("select * from public.get_counts(array['a']);")).toHaveLength(1);
  });

  it("reports each missing function once per migration", () => {
    const findings = forwardReferences(
      "select public.missing(); select public.missing(); select public.missing();"
    );

    expect(findings).toHaveLength(1);
  });
});

describe("definition ordering", () => {
  it("accepts a definition earlier in the same migration", () => {
    const sql = `
      create or replace function public.helper() returns void as $$ begin end $$ language plpgsql;
      select public.helper();
    `;

    expect(analyzeOne(sql)).toEqual([]);
  });

  it("rejects a call placed before its definition in the same migration", () => {
    const sql = `
      select public.helper();
      create or replace function public.helper() returns void as $$ begin end $$ language plpgsql;
    `;
    const findings = forwardReferences(sql);

    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("before its definition later in this same file");
  });

  it("accepts a definition from an earlier migration", () => {
    const findings = analyzeMigrations([
      migration(
        "20260101000000_define.sql",
        "create or replace function public.helper() returns void as $$ begin end $$ language plpgsql;"
      ),
      migration("20260102000000_use.sql", "select public.helper();"),
    ]);

    expect(findings).toEqual([]);
  });

  it("ignores a reference inside a function body, which resolves at call time", () => {
    const sql = `create or replace function public.outer_fn() returns void as $body$
        begin
          perform public.defined_later();
        end
      $body$ language plpgsql;`;

    expect(analyzeOne(sql)).toEqual([]);
  });
});

describe("the rls_auto_enable historical gap", () => {
  it("is allowed only because it is on the bootstrap list", () => {
    expect(BOOTSTRAP_FUNCTIONS.has("rls_auto_enable")).toBe(true);
    expect(forwardReferences("select public.rls_auto_enable();")).toEqual([]);
    expect(forwardReferences("select public.some_other_missing_helper();")).toHaveLength(1);
  });
});

describe("filename and ordering rules", () => {
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

  it("detects duplicate logical names", () => {
    const findings = analyzeMigrations([
      migration("20260101000000_same_name.sql", "select 1;"),
      migration("20260102000000_same_name.sql", "select 1;"),
    ]);

    expect(findings.some((finding) => finding.kind === "duplicate-name")).toBe(true);
  });

  it("rejects a malformed filename", () => {
    expect(analyzeMigrations([migration("not-a-migration.sql", "select 1;")])[0].kind).toBe(
      "filename"
    );
  });
});

describe("parsing helpers", () => {
  it("blanks comments and literals without changing length", () => {
    const sql = "-- select public.a();\n/* public.b() */ select 'public.c()';";
    const blanked = blankNonCode(sql);

    expect(blanked).toHaveLength(sql.length);
    expect(extractImmediateReferences(sql)).toEqual([]);
  });

  it("blanks function bodies without changing length", () => {
    const sql =
      "create function public.a() as $tag$ perform public.hidden(); $tag$ language plpgsql; select public.visible();";
    const stripped = stripFunctionBodies(sql);

    expect(stripped).toHaveLength(sql.length);
    expect(stripped).not.toContain("public.hidden()");
    expect(stripped).toContain("public.visible()");
  });

  it("reads the preceding word, or empty when punctuation precedes", () => {
    expect(precedingWord("create table public.x (", 13)).toBe("table");
    expect(precedingWord("(public.x (", 1)).toBe("");
  });

  it("extracts definitions with and without the public prefix", () => {
    expect([...extractDefinedFunctions("create function public.with_prefix() returns void").keys()]).toContain(
      "with_prefix"
    );
    expect(
      [...extractDefinedFunctions("create or replace function without_prefix() returns void").keys()]
    ).toContain("without_prefix");
  });
});

describe("strict mode exit codes", () => {
  // The migration_dependencies job runs `npm run migration:check-order:strict`
  // and sits inside Required CI. If a finding did not make the process exit
  // non-zero, that gate would be decorative. The unit tests above prove the
  // analysis; these prove the CLI contract the workflow actually depends on.
  //
  // The checker is spawned through process.execPath rather than its shebang,
  // so this behaves identically everywhere and does not depend on the script
  // being marked executable or on its line endings.
  const scriptPath = fileURLToPath(
    new URL("./check-migration-dependencies.mjs", import.meta.url)
  );

  function runChecker(files, args = []) {
    const workdir = mkdtempSync(join(tmpdir(), "jnuits-migration-scan-"));
    const migrationsDir = join(workdir, "supabase", "migrations");
    mkdirSync(migrationsDir, { recursive: true });

    for (const [filename, sql] of Object.entries(files)) {
      writeFileSync(join(migrationsDir, filename), sql, "utf8");
    }

    try {
      return spawnSync(process.execPath, [scriptPath, ...args], {
        cwd: workdir,
        encoding: "utf8",
      });
    } finally {
      rmSync(workdir, { recursive: true, force: true });
    }
  }

  const cleanChain = {
    "20260101000000_define.sql":
      "create or replace function public.helper() returns void as $$ begin end $$ language plpgsql;\n",
    "20260102000000_use.sql": "select public.helper();\n",
  };

  const forwardReferenceChain = {
    "20260101000000_use_too_early.sql": "select public.helper();\n",
    "20260102000000_define.sql":
      "create or replace function public.helper() returns void as $$ begin end $$ language plpgsql;\n",
  };

  it("exits zero on a clean chain under --strict", () => {
    const result = runChecker(cleanChain, ["--strict"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Inspected 2 migrations.");
    expect(result.stdout).toContain("no findings");
  });

  it("exits non-zero on a finding under --strict", () => {
    const result = runChecker(forwardReferenceChain, ["--strict"]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("forward-reference");
    expect(result.stdout).toContain("public.helper()");
  });

  it("still exits zero on the same finding in report mode", () => {
    const result = runChecker(forwardReferenceChain);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("forward-reference");
    expect(result.stdout).toContain("Report-only mode");
  });
});

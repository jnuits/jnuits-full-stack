import process from "node:process";
import {
  buildLegacyMysqlConnection,
  buildSupabaseAdminClient,
  resolveReportPath,
  slugify,
  writeJsonReport,
} from "./lib/legacy-content.mjs";

const DEFAULTS = {
  advisorySlug: "advisory-committee",
  advisoryTitle: "Advisory Committee",
  endsOn: "",
  executiveSlug: "5th-committee",
  executiveTitle: "5th Committee",
  mode: "dry-run",
  report: "",
  startsOn: "2026-01-01",
};

const ROLE_OVERRIDES = new Map([
  ["Asst. General Secretary", { code: "assistant-general-secretary", sortOrder: 35 }],
  ["Chief Advisor", { code: "chief-advisor", sortOrder: 10 }],
  ["Edu & Research Secretary", { code: "education-research-secretary", sortOrder: 95 }],
  ["Executive", { code: "executive-member", sortOrder: 110 }],
  ["General Secretary", { code: "general-secretary", sortOrder: 30 }],
  ["International Secretary", { code: "international-secretary", sortOrder: 92 }],
  ["IT Secretary", { code: "it-secretary", sortOrder: 91 }],
  ["Mentor / Moderator", { code: "mentor-moderator", sortOrder: 20 }],
  ["Office Secretary", { code: "office-secretary", sortOrder: 60 }],
  ["Organizing Secretary", { code: "organizing-secretary", sortOrder: 50 }],
  ["President", { code: "president", sortOrder: 10 }],
  ["Public Relation Secretary", {
    code: "public-relations-secretary",
    sortOrder: 80,
  }],
  ["Publication Secretary", { code: "publication-secretary", sortOrder: 90 }],
  ["Respected Advisor", { code: "respected-advisor", sortOrder: 30 }],
  ["Sub-Executive", { code: "sub-executive-member", sortOrder: 115 }],
  ["Treasurer", { code: "treasurer", sortOrder: 70 }],
  ["Vice President", { code: "vice-president", sortOrder: 20 }],
  ["Workshop Secretary", { code: "workshop-secretary", sortOrder: 55 }],
]);

function parseArgs(argv) {
  const options = { ...DEFAULTS };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--apply") {
      options.mode = "apply";
      continue;
    }

    if (token === "--dry-run") {
      options.mode = "dry-run";
      continue;
    }

    if (token === "--report" && argv[index + 1]) {
      options.report = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith("--report=")) {
      options.report = token.split("=")[1] || "";
      continue;
    }

    if (token === "--starts-on" && argv[index + 1]) {
      options.startsOn = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith("--starts-on=")) {
      options.startsOn = token.split("=")[1] || "";
      continue;
    }

    if (token === "--ends-on" && argv[index + 1]) {
      options.endsOn = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith("--ends-on=")) {
      options.endsOn = token.split("=")[1] || "";
      continue;
    }
  }

  return options;
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function buildSignature({ memberId, displayName, roleCode, sortOrder }) {
  const normalizedSort = Number.isFinite(Number(sortOrder))
    ? Math.trunc(Number(sortOrder))
    : 1000;

  if (memberId) {
    return `m:${memberId}|r:${roleCode}|o:${normalizedSort}`;
  }

  return `e:${normalizeName(displayName)}|r:${roleCode}|o:${normalizedSort}`;
}

function getRoleDefinition(title) {
  const trimmedTitle = String(title || "").trim() || "Committee Member";
  const override = ROLE_OVERRIDES.get(trimmedTitle);

  if (override) {
    return {
      code: override.code,
      sortOrder: override.sortOrder,
      title: trimmedTitle,
    };
  }

  return {
    code: slugify(trimmedTitle),
    sortOrder: 120,
    title: trimmedTitle,
  };
}

function mapTermConfig(key, options) {
  if (key === "advisory") {
    return {
      isExecutive: false,
      slug: options.advisorySlug,
      sourceTable: "advisory_committees",
      status: "active",
      summary:
        "Legacy advisory roster imported from the previous JnUITS platform for public verification and continuity.",
      title: options.advisoryTitle,
    };
  }

  return {
    isExecutive: true,
    slug: options.executiveSlug,
    sourceTable: "fifth_committees",
    status: "active",
    summary:
      "Legacy executive roster imported from the previous JnUITS platform for public continuity and operator rollover.",
    title: options.executiveTitle,
  };
}

function makeReport(options) {
  return {
    generatedAt: new Date().toISOString(),
    mode: options.mode,
    options: {
      advisorySlug: options.advisorySlug,
      advisoryTitle: options.advisoryTitle,
      endsOn: options.endsOn || null,
      executiveSlug: options.executiveSlug,
      executiveTitle: options.executiveTitle,
      startsOn: options.startsOn,
    },
    sourceCounts: {
      advisoryRows: 0,
      executiveRows: 0,
    },
    target: {
      advisoryAssignments: 0,
      executiveAssignments: 0,
      termsUpserted: 0,
      rolesUpserted: 0,
    },
    terms: [],
    roles: [],
    assignments: {
      advisory: {
        created: 0,
        existing: 0,
        linkedMembers: 0,
        placeholders: 0,
        uniquePlanned: 0,
      },
      executive: {
        created: 0,
        existing: 0,
        linkedMembers: 0,
        placeholders: 0,
        uniquePlanned: 0,
      },
    },
  };
}

async function fetchLegacyAssignments(connection, tableName) {
  const [rows] = await connection.query(
    `select id, name, designation, email, phone, website, priority
     from ${tableName}
     order by priority asc, id asc`
  );

  return rows;
}

async function ensureRoles(supabase, assignments, apply, report) {
  const definitions = Array.from(
    new Map(
      assignments.map((assignment) => {
        const definition = getRoleDefinition(assignment.designation);
        return [definition.code, definition];
      })
    ).values()
  ).sort((left, right) => left.sortOrder - right.sortOrder);

  report.roles = definitions.map((definition) => ({
    code: definition.code,
    sortOrder: definition.sortOrder,
    title: definition.title,
  }));

  if (!apply || definitions.length === 0) {
    return new Map(
      definitions.map((definition) => [
        definition.code,
        {
          ...definition,
          id: definition.code,
        },
      ])
    );
  }

  const { error } = await supabase.from("committee_roles").upsert(
    definitions.map((definition) => ({
      code: definition.code,
      is_executive: definition.code !== "chief-advisor" &&
        definition.code !== "mentor-moderator" &&
        definition.code !== "respected-advisor",
      is_public: true,
      sort_order: definition.sortOrder,
      title: definition.title,
    })),
    { onConflict: "code" }
  );

  if (error) {
    throw error;
  }

  report.target.rolesUpserted = definitions.length;

  const { data: roles, error: rolesError } = await supabase
    .from("committee_roles")
    .select("id, code, title, sort_order")
    .in(
      "code",
      definitions.map((definition) => definition.code)
    );

  if (rolesError) {
    throw rolesError;
  }

  return new Map(
    (roles || []).map((role) => [
      role.code,
      {
        code: role.code,
        id: role.id,
        sortOrder: role.sort_order,
        title: role.title,
      },
    ])
  );
}

async function ensureTerm(supabase, termConfig, actorUserId, options, apply) {
  if (!apply) {
    return {
      id: `${termConfig.slug}-planned`,
      ...termConfig,
    };
  }

  const payload = {
    created_by_user_id: actorUserId || null,
    ends_on: options.endsOn || null,
    is_public: true,
    slug: termConfig.slug,
    starts_on: options.startsOn,
    status: termConfig.status,
    summary: termConfig.summary,
    title: termConfig.title,
  };

  const { error } = await supabase
    .from("committee_terms")
    .upsert(payload, { onConflict: "slug" });

  if (error) {
    throw error;
  }

  const { data, error: selectError } = await supabase
    .from("committee_terms")
    .select("id, slug, title, status, is_public")
    .eq("slug", termConfig.slug)
    .single();

  if (selectError || !data) {
    throw selectError || new Error(`Unable to load committee term ${termConfig.slug}.`);
  }

  return data;
}

async function loadCurrentMembers(supabase) {
  const { data, error } = await supabase
    .from("members")
    .select("id, full_name, email, jnuits_id")
    .limit(500);

  if (error) {
    throw error;
  }

  const byEmail = new Map();
  const byName = new Map();

  for (const member of data || []) {
    const normalizedEmail = normalizeEmail(member.email);
    const normalizedName = normalizeName(member.full_name);

    if (normalizedEmail && !byEmail.has(normalizedEmail)) {
      byEmail.set(normalizedEmail, member);
    }

    if (normalizedName && !byName.has(normalizedName)) {
      byName.set(normalizedName, member);
    }
  }

  return { byEmail, byName };
}

function resolveMember(lookup, row) {
  const normalizedEmail = normalizeEmail(row.email);

  if (normalizedEmail && lookup.byEmail.has(normalizedEmail)) {
    return lookup.byEmail.get(normalizedEmail);
  }

  const normalizedName = normalizeName(row.name);

  if (normalizedName && lookup.byName.has(normalizedName)) {
    return lookup.byName.get(normalizedName);
  }

  return null;
}

async function loadExistingAssignmentSignatures(supabase, termId) {
  const { data, error } = await supabase
    .from("committee_assignments")
    .select("id, display_name, sort_order, member_id, role_id, committee_roles(code)")
    .eq("term_id", termId);

  if (error) {
    throw error;
  }

  return new Set(
    (data || []).map((assignment) =>
      buildSignature({
        displayName: assignment.display_name || "",
        memberId: assignment.member_id,
        roleCode: Array.isArray(assignment.committee_roles)
          ? assignment.committee_roles[0]?.code || ""
          : assignment.committee_roles?.code || "",
        sortOrder: assignment.sort_order,
      })
    )
  );
}

async function processTermAssignments({
  apply,
  currentMembers,
  key,
  report,
  roleMap,
  rows,
  supabase,
  term,
}) {
  const stats = report.assignments[key];
  const existingSignatures = apply
    ? await loadExistingAssignmentSignatures(supabase, term.id)
    : new Set();
  const createdSignatures = new Set();
  const inserts = [];

  for (const row of rows) {
    const role = roleMap.get(getRoleDefinition(row.designation).code);

    if (!role?.id) {
      throw new Error(`Missing role mapping for ${row.designation}.`);
    }

    const linkedMember = resolveMember(currentMembers, row);
    const signature = buildSignature({
      displayName: row.name,
      memberId: linkedMember?.id || null,
      roleCode: role.code,
      sortOrder: row.priority,
    });

    if (existingSignatures.has(signature) || createdSignatures.has(signature)) {
      stats.existing += 1;
      continue;
    }

    createdSignatures.add(signature);
    stats.uniquePlanned += 1;

    if (linkedMember) {
      stats.linkedMembers += 1;
    } else {
      stats.placeholders += 1;
    }

    inserts.push({
      bio: null,
      created_by_user_id: process.env.SUPABASE_REPORT_ACTOR_USER_ID || null,
      display_name: linkedMember ? null : String(row.name || "").trim() || null,
      ends_on: null,
      member_id: linkedMember?.id || null,
      role_id: role.id,
      sort_order: Number.isFinite(Number(row.priority))
        ? Math.trunc(Number(row.priority))
        : role.sortOrder,
      starts_on: term.starts_on || DEFAULTS.startsOn,
      status: "active",
      term_id: term.id,
    });
  }

  if (apply && inserts.length > 0) {
    const { error } = await supabase.from("committee_assignments").insert(inserts);

    if (error) {
      throw error;
    }
  }

  stats.created = inserts.length;
}

async function recordEvidence({
  advisoryRows,
  actorUserId,
  apply,
  executiveRows,
  report,
  supabase,
  terms,
}) {
  if (!apply) {
    return;
  }

  await supabase.from("operator_reports").insert({
    created_by_user_id: actorUserId || null,
    report,
    report_type: "committee_roster",
    status: "completed",
    summary: `Legacy committee import created ${report.assignments.advisory.created} advisory and ${report.assignments.executive.created} executive assignments.`,
    title: "Legacy committee roster import",
  });

  await supabase.from("audit_events").insert({
    actor_user_id: actorUserId || null,
    action: "committee.legacy_imported",
    entity_type: "committee_term",
    entity_id: terms.executive.id,
    metadata: {
      advisoryRows: advisoryRows.length,
      executiveRows: executiveRows.length,
      importedAt: report.generatedAt,
      termSlugs: [terms.advisory.slug, terms.executive.slug],
    },
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const apply = options.mode === "apply";
  const reportPath = resolveReportPath("committee", "legacy-committee-import-report", options.report);
  const report = makeReport(options);
  const actorUserId = process.env.SUPABASE_REPORT_ACTOR_USER_ID || null;
  const legacy = await buildLegacyMysqlConnection();

  try {
    const [advisoryRows, executiveRows] = await Promise.all([
      fetchLegacyAssignments(legacy, "advisory_committees"),
      fetchLegacyAssignments(legacy, "fifth_committees"),
    ]);

    report.sourceCounts.advisoryRows = advisoryRows.length;
    report.sourceCounts.executiveRows = executiveRows.length;

    const supabase = buildSupabaseAdminClient();
    const currentMembers = await loadCurrentMembers(supabase);
    const roleMap = await ensureRoles(
      supabase,
      [...advisoryRows, ...executiveRows],
      apply,
      report
    );

    const terms = {
      advisory: await ensureTerm(
        supabase,
        mapTermConfig("advisory", options),
        actorUserId,
        options,
        apply
      ),
      executive: await ensureTerm(
        supabase,
        mapTermConfig("executive", options),
        actorUserId,
        options,
        apply
      ),
    };

    report.terms = [terms.advisory, terms.executive].map((term) => ({
      id: term.id,
      slug: term.slug,
      status: term.status,
      title: term.title,
    }));
    report.target.termsUpserted = report.terms.length;

    await processTermAssignments({
      apply,
      currentMembers,
      key: "advisory",
      report,
      roleMap,
      rows: advisoryRows,
      supabase,
      term: { ...terms.advisory, starts_on: options.startsOn },
    });
    await processTermAssignments({
      apply,
      currentMembers,
      key: "executive",
      report,
      roleMap,
      rows: executiveRows,
      supabase,
      term: { ...terms.executive, starts_on: options.startsOn },
    });

    report.target.advisoryAssignments = report.assignments.advisory.uniquePlanned;
    report.target.executiveAssignments = report.assignments.executive.uniquePlanned;

    await recordEvidence({
      actorUserId,
      advisoryRows,
      apply,
      executiveRows,
      report,
      supabase,
      terms,
    });

    writeJsonReport(reportPath, report);

    console.log("");
    console.log("Legacy committee import complete.");
    console.log(`Mode: ${options.mode}`);
    console.log(`Report: ${reportPath}`);
    console.log(`Advisory unique assignments: ${report.assignments.advisory.uniquePlanned}`);
    console.log(`Executive unique assignments: ${report.assignments.executive.uniquePlanned}`);
    console.log(`Roles prepared: ${report.roles.length}`);
  } finally {
    await legacy.end();
  }
}

main().catch((error) => {
  console.error("Legacy committee import failed.");
  console.error(error);
  process.exitCode = 1;
});

import process from "node:process";
import {
  buildGeneratedJnuitsId,
  buildSupabaseAdminClient,
  getInvitationExpiryIso,
  getNextInvitation,
  loadCsv,
  normalizeDepartmentToken,
  normalizeMemberRow,
  parseCliArgs,
  persistOperatorReport,
  resolveMembershipReportPath,
  writeJsonReport,
} from "./lib/members.mjs";

function buildDepartmentResolver(rows) {
  const byCode = new Map();
  const byNameToken = new Map();
  const aliases = new Map([
    ["cse", "computer-science-engineering"],
    ["computer science engineering", "computer-science-engineering"],
    ["computer science and engineering", "computer-science-engineering"],
    ["mass communication and journalism", "mass-communication-journalism"],
    ["ais", "accounting-information-system"],
    ["geb", "genetic-engineering-biotechnology"],
    ["ier", "institute-of-education-and-research"],
    ["iml", "institute-of-modern-languages"],
  ]);

  for (const row of rows) {
    if (!row.code) {
      continue;
    }

    const canonicalCode = String(row.code).toLowerCase();
    const codeToken = normalizeDepartmentToken(canonicalCode).replaceAll(" ", "-");
    byCode.set(canonicalCode, canonicalCode);
    byCode.set(codeToken, canonicalCode);

    const nameToken = normalizeDepartmentToken(row.name || "");

    if (nameToken) {
      byNameToken.set(nameToken, canonicalCode);
    }
  }

  return (rawValue) => {
    if (!rawValue) {
      return {
        departmentCode: null,
        error: null,
      };
    }

    const token = normalizeDepartmentToken(rawValue);
    const slugToken = token.replaceAll(" ", "-");

    if (byCode.has(rawValue.toLowerCase())) {
      return { departmentCode: byCode.get(rawValue.toLowerCase()), error: null };
    }

    if (byCode.has(slugToken)) {
      return { departmentCode: byCode.get(slugToken), error: null };
    }

    if (byNameToken.has(token)) {
      return { departmentCode: byNameToken.get(token), error: null };
    }

    const aliasTarget = aliases.get(token);

    if (aliasTarget && byCode.has(aliasTarget)) {
      return { departmentCode: aliasTarget, error: null };
    }

    return {
      departmentCode: null,
      error: `departmentCode '${rawValue}' did not match any seeded department`,
    };
  };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (!args.file) {
    throw new Error(
      "Usage: npm run members:onboard -- --file path/to/onboarding.csv [--dry-run|--apply] [--generate-invitations] [--persist-report]"
    );
  }

  const admin = buildSupabaseAdminClient();
  const csv = loadCsv(args.file);
  const reportRows = [];
  const counters = {
    created: 0,
    invitationsFailed: 0,
    invitationsGenerated: 0,
    updated: 0,
    validationErrors: 0,
    writeFailures: 0,
  };

  const [existingMemberRowsResult, departmentsResult] = await Promise.all([
    admin.from("members").select("id, jnuits_id, email, is_profile_claimed"),
    admin.from("departments").select("code, name").eq("is_active", true),
  ]);

  if (existingMemberRowsResult.error) {
    throw new Error(existingMemberRowsResult.error.message);
  }

  if (departmentsResult.error) {
    throw new Error(departmentsResult.error.message);
  }

  const existingMemberRows = existingMemberRowsResult.data || [];
  const resolveDepartmentCode = buildDepartmentResolver(departmentsResult.data || []);
  const existingByJnuitsId = new Map();
  const existingByEmail = new Map();

  for (const member of existingMemberRows) {
    if (member.jnuits_id) {
      existingByJnuitsId.set(member.jnuits_id, member);
    }

    if (member.email) {
      existingByEmail.set(member.email.toLowerCase(), member);
    }
  }

  const knownIds = existingMemberRows.map((member) => member.jnuits_id);

  for (let index = 0; index < csv.rows.length; index += 1) {
    const raw = csv.rows[index];
    const row = normalizeMemberRow(raw);
    const rowNumber = index + 2;
    const validationErrors = [];
    const departmentResolution = resolveDepartmentCode(row.departmentCode);

    if (!row.fullName) {
      validationErrors.push("fullName is required");
    }

    if (row.departmentCode && !departmentResolution.departmentCode) {
      validationErrors.push(
        departmentResolution.error ||
          "departmentCode could not be normalized against seeded departments"
      );
    }

    if (row.email && !row.email.includes("@")) {
      validationErrors.push("email is invalid");
    }

    if (validationErrors.length > 0) {
      counters.validationErrors += 1;
      reportRows.push({
        action: "validation_error",
        rowNumber,
        row,
        validationErrors,
      });
      continue;
    }

    const existingMember =
      (row.jnuitsId ? existingByJnuitsId.get(row.jnuitsId) : null) ||
      (row.email ? existingByEmail.get(row.email) : null) ||
      null;

    const jnuitsId =
      row.jnuitsId || existingMember?.jnuits_id || buildGeneratedJnuitsId(knownIds);

    if (!knownIds.includes(jnuitsId)) {
      knownIds.push(jnuitsId);
    }

    const payload = {
      alumni_since: row.alumniSince,
      batch_no: row.batchNo,
      current_organization: row.currentOrganization,
      department_code: departmentResolution.departmentCode,
      designation: row.designation,
      email: row.email,
      full_name: row.fullName,
      jnuits_id: jnuitsId,
      linkedin_url: row.linkedinUrl,
      member_type: row.memberType,
      phone: row.phone,
      professional_visibility: row.professionalVisibility,
      website_url: row.websiteUrl,
      work_location: row.workLocation,
    };

    let memberId = existingMember?.id || null;
    let invitationCode = null;
    let invitationFailed = false;

    if (args.apply) {
      if (existingMember) {
        const { error } = await admin
          .from("members")
          .update(payload)
          .eq("id", existingMember.id);

        if (error) {
          counters.writeFailures += 1;
          reportRows.push({
            action: "update_failed",
            message: error.message,
            rowNumber,
            row,
          });
          continue;
        }

        counters.updated += 1;
        memberId = existingMember.id;
      } else {
        const { data: createdMember, error } = await admin
          .from("members")
          .insert(payload)
          .select("id")
          .single();

        if (error || !createdMember) {
          counters.writeFailures += 1;
          reportRows.push({
            action: "create_failed",
            message: error?.message || "Unable to create member.",
            rowNumber,
            row,
          });
          continue;
        }

        counters.created += 1;
        memberId = createdMember.id;
      }

      if (row.email && memberId) {
        const memberSnapshot = {
          id: memberId,
          jnuits_id: jnuitsId,
          email: row.email,
          is_profile_claimed: existingMember?.is_profile_claimed || false,
        };

        existingByEmail.set(row.email, memberSnapshot);
        existingByJnuitsId.set(jnuitsId, memberSnapshot);
      }

      if (
        memberId &&
        (args.generateInvitations || row.generateInvitation) &&
        !(existingMember?.is_profile_claimed || false)
      ) {
        const nextInvitation = await getNextInvitation(admin);
        const expiresAt = row.expiresAt || getInvitationExpiryIso(args.expiryDays);
        const maxUses = row.maxUses || args.maxUses;

        const { error } = await admin.from("member_invitations").insert({
          code_hash: nextInvitation.codeHash,
          expires_at: expiresAt,
          max_uses: maxUses,
          member_id: memberId,
          notes: "CSV onboarding invitation",
        });

        if (!error) {
          invitationCode = nextInvitation.code;
          counters.invitationsGenerated += 1;
        } else {
          invitationFailed = true;
          counters.invitationsFailed += 1;
        }
      }
    }

    reportRows.push({
      action: existingMember ? "update_member" : "create_member",
      invitationFailed,
      invitationGenerated: Boolean(invitationCode),
      invitationCode,
      jnuitsId,
      memberId,
      mode: args.apply ? "apply" : "dry-run",
      normalizedDepartmentCode: departmentResolution.departmentCode,
      rowNumber,
      row,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: args.apply ? "apply" : "dry-run",
    sourceFile: csv.filePath,
    summary: counters,
    rows: reportRows,
  };

  const reportPath = resolveMembershipReportPath("csv-onboarding", args.report);
  writeJsonReport(reportPath, report);

  if (args.persistReport) {
    await persistOperatorReport(admin, {
      report,
      reportType: "csv_onboarding",
      summary: `CSV onboarding ${args.apply ? "apply" : "dry-run"} with ${counters.created} created and ${counters.updated} updated members.`,
      title: `CSV onboarding ${args.apply ? "apply" : "dry-run"}`,
    });
  }

  console.log(
    JSON.stringify(
      {
        ...counters,
        mode: args.apply ? "apply" : "dry-run",
        reportPath,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : "Unknown onboarding error",
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});

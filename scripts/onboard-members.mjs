import process from "node:process";
import {
  buildGeneratedJnuitsId,
  buildSupabaseAdminClient,
  getInvitationExpiryIso,
  getNextInvitation,
  loadCsv,
  normalizeMemberRow,
  parseCliArgs,
  persistOperatorReport,
  resolveMembershipReportPath,
  writeJsonReport,
} from "./lib/members.mjs";

async function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (!args.file) {
    throw new Error("Usage: npm run members:onboard -- --file path/to/onboarding.csv [--dry-run|--apply] [--generate-invitations] [--persist-report]");
  }

  const admin = buildSupabaseAdminClient();
  const csv = loadCsv(args.file);
  const reportRows = [];
  const counters = {
    created: 0,
    invitationsGenerated: 0,
    updated: 0,
    validationErrors: 0,
  };

  const { data: existingMemberRows } = await admin
    .from("members")
    .select("id, jnuits_id, email, is_profile_claimed");

  const existingByJnuitsId = new Map();
  const existingByEmail = new Map();

  for (const member of existingMemberRows || []) {
    if (member.jnuits_id) {
      existingByJnuitsId.set(member.jnuits_id, member);
    }

    if (member.email) {
      existingByEmail.set(member.email.toLowerCase(), member);
    }
  }

  const knownIds = (existingMemberRows || []).map((member) => member.jnuits_id);

  for (let index = 0; index < csv.rows.length; index += 1) {
    const raw = csv.rows[index];
    const row = normalizeMemberRow(raw);
    const rowNumber = index + 2;
    const validationErrors = [];

    if (!row.fullName) {
      validationErrors.push("fullName is required");
    }

    if (row.departmentCode && row.departmentCode.length > 12) {
      validationErrors.push("departmentCode is too long");
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
      row.jnuitsId ||
      existingMember?.jnuits_id ||
      buildGeneratedJnuitsId(knownIds);

    if (!knownIds.includes(jnuitsId)) {
      knownIds.push(jnuitsId);
    }

    const payload = {
      alumni_since: row.alumniSince,
      batch_no: row.batchNo,
      current_organization: row.currentOrganization,
      department_code: row.departmentCode,
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

    if (args.apply) {
      if (existingMember) {
        const { error } = await admin
          .from("members")
          .update(payload)
          .eq("id", existingMember.id);

        if (error) {
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

      if (
        memberId &&
        (args.generateInvitations || row.generateInvitation) &&
        !(existingMember?.is_profile_claimed || false)
      ) {
        const nextInvitation = await getNextInvitation(admin);
        const expiresAt =
          row.expiresAt || getInvitationExpiryIso(args.expiryDays);
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
        }
      }
    }

    reportRows.push({
      action: existingMember ? "update_member" : "create_member",
      invitationGenerated: Boolean(invitationCode),
      invitationCode,
      jnuitsId,
      memberId,
      mode: args.apply ? "apply" : "dry-run",
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

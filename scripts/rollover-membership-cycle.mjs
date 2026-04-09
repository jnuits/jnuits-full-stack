import process from "node:process";
import {
  buildSupabaseAdminClient,
  persistOperatorReport,
  resolveMembershipReportPath,
  writeJsonReport,
} from "./lib/members.mjs";

function parseRolloverArgs(argv) {
  const args = {
    apply: false,
    carryMembers: true,
    closeSource: true,
    code: "",
    endsOn: "",
    renewalCloseOn: "",
    renewalOpenOn: "",
    report: "",
    sourceCycleId: "",
    startsOn: "",
    status: "active",
    title: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--apply") {
      args.apply = true;
      continue;
    }

    if (value === "--dry-run") {
      args.apply = false;
      continue;
    }

    if (value === "--source-cycle-id") {
      args.sourceCycleId = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (value === "--title") {
      args.title = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (value === "--code") {
      args.code = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (value === "--starts-on") {
      args.startsOn = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (value === "--ends-on") {
      args.endsOn = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (value === "--renewal-open-on") {
      args.renewalOpenOn = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (value === "--renewal-close-on") {
      args.renewalCloseOn = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (value === "--status") {
      args.status = argv[index + 1] || "active";
      index += 1;
      continue;
    }

    if (value === "--carry-members") {
      args.carryMembers = (argv[index + 1] || "true") === "true";
      index += 1;
      continue;
    }

    if (value === "--close-source") {
      args.closeSource = (argv[index + 1] || "true") === "true";
      index += 1;
      continue;
    }

    if (value === "--report") {
      args.report = argv[index + 1] || "";
      index += 1;
    }
  }

  return args;
}

async function main() {
  const args = parseRolloverArgs(process.argv.slice(2));

  if (!args.sourceCycleId || !args.title || !args.code || !args.startsOn) {
    throw new Error(
      "Usage: npm run members:rollover-cycle -- --source-cycle-id <uuid> --title <name> --code <slug> --starts-on <yyyy-mm-dd> [--apply]"
    );
  }

  const admin = buildSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const normalizedCode = args.code.trim().toLowerCase();
  const normalizedStatus = ["draft", "active", "closed", "archived"].includes(
    args.status
  )
    ? args.status
    : "active";

  const { data: sourceCycle, error: sourceCycleError } = await admin
    .from("membership_cycles")
    .select("id, code, title, starts_on, ends_on, status")
    .eq("id", args.sourceCycleId)
    .maybeSingle();

  if (sourceCycleError || !sourceCycle) {
    throw new Error(sourceCycleError?.message || "Source cycle not found.");
  }

  const carryMembersResult = args.carryMembers
    ? await admin
        .from("membership_cycle_memberships")
        .select("member_id, state")
        .eq("cycle_id", sourceCycle.id)
        .in("state", ["active", "renewed", "pending_renewal"])
    : { data: [], error: null };

  if (carryMembersResult.error) {
    throw new Error(carryMembersResult.error.message);
  }

  const carriedMembers = carryMembersResult.data || [];
  let newCycleId = null;
  let carriedCount = 0;
  const writes = [];

  if (args.apply) {
    const { data: createdCycle, error: createCycleError } = await admin
      .from("membership_cycles")
      .insert({
        code: normalizedCode,
        ends_on: args.endsOn || null,
        renewal_close_on: args.renewalCloseOn || null,
        renewal_open_on: args.renewalOpenOn || null,
        starts_on: args.startsOn,
        status: normalizedStatus,
        title: args.title.trim(),
      })
      .select("id")
      .single();

    if (createCycleError || !createdCycle) {
      throw new Error(createCycleError?.message || "Failed to create new cycle.");
    }

    newCycleId = createdCycle.id;
    writes.push("created_cycle");

    if (args.carryMembers && carriedMembers.length > 0) {
      const rows = carriedMembers.map((entry) => ({
        cycle_id: createdCycle.id,
        enrolled_at: nowIso,
        member_id: entry.member_id,
        note: "Created by membership cycle rollover.",
        state: "pending_renewal",
      }));

      const { error: carryError } = await admin
        .from("membership_cycle_memberships")
        .insert(rows);

      if (carryError) {
        throw new Error(carryError.message);
      }

      carriedCount = rows.length;
      writes.push("carried_members");
    }

    if (args.closeSource) {
      const { error: closeError } = await admin
        .from("membership_cycles")
        .update({
          status: "closed",
        })
        .eq("id", sourceCycle.id);

      if (closeError) {
        throw new Error(closeError.message);
      }

      writes.push("closed_source_cycle");
    }

    await persistOperatorReport(admin, {
      report: {
        appliedAt: nowIso,
        carriedCount,
        mode: "apply",
        newCycleId,
        sourceCycleId: sourceCycle.id,
        writes,
      },
      reportType: "membership_reconciliation",
      summary: `Membership cycle rollover apply: ${sourceCycle.code} -> ${normalizedCode} (${carriedCount} carried members).`,
      title: `Membership cycle rollover apply (${normalizedCode})`,
    });
  }

  const report = {
    generatedAt: nowIso,
    mode: args.apply ? "apply" : "dry-run",
    sourceCycle: {
      code: sourceCycle.code,
      id: sourceCycle.id,
      status: sourceCycle.status,
      title: sourceCycle.title,
    },
    targetCycle: {
      code: normalizedCode,
      endsOn: args.endsOn || null,
      renewalCloseOn: args.renewalCloseOn || null,
      renewalOpenOn: args.renewalOpenOn || null,
      startsOn: args.startsOn,
      status: normalizedStatus,
      title: args.title.trim(),
    },
    summary: {
      carriedMembersCandidateCount: carriedMembers.length,
      carriedMembersCount: carriedCount,
      closeSource: args.closeSource,
      newCycleId,
      writes,
    },
  };

  const reportPath = resolveMembershipReportPath(
    "membership-cycle-rollover",
    args.report
  );
  writeJsonReport(reportPath, report);

  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        reportPath,
        summary: report.summary,
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
        error:
          error instanceof Error
            ? error.message
            : "Unknown membership cycle rollover error",
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});

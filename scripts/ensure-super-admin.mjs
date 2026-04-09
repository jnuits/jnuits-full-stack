#!/usr/bin/env node

import process from "node:process";
import {
  buildSupabaseAdminClient,
  resolveMembershipReportPath,
  writeJsonReport,
} from "./lib/members.mjs";

function parseArgs(argv) {
  const options = {
    apply: true,
    email: "jnuitsbd@gmail.com",
    report: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--dry-run") {
      options.apply = false;
      continue;
    }

    if (token === "--apply") {
      options.apply = true;
      continue;
    }

    if (token === "--email" && argv[index + 1]) {
      options.email = String(argv[index + 1]).trim().toLowerCase();
      index += 1;
      continue;
    }

    if (token === "--report" && argv[index + 1]) {
      options.report = argv[index + 1];
      index += 1;
      continue;
    }
  }

  return options;
}

async function resolveUserId(admin, email) {
  const profileResult = await admin
    .from("profiles")
    .select("id, email, full_name")
    .ilike("email", email)
    .maybeSingle();

  if (profileResult.error) {
    throw new Error(`profiles lookup failed: ${profileResult.error.message}`);
  }

  if (profileResult.data?.id) {
    return {
      source: "profiles",
      userId: profileResult.data.id,
    };
  }

  const memberResult = await admin
    .from("members")
    .select("id, user_id, email, full_name")
    .ilike("email", email)
    .not("user_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (memberResult.error) {
    throw new Error(`members lookup failed: ${memberResult.error.message}`);
  }

  if (memberResult.data?.user_id) {
    return {
      source: "members",
      userId: memberResult.data.user_id,
    };
  }

  return {
    source: "none",
    userId: null,
  };
}

async function ensureRole(admin, code, title, apply) {
  const existing = await admin
    .from("rbac_platform_roles")
    .select("id, code, title")
    .eq("code", code)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`role lookup failed for ${code}: ${existing.error.message}`);
  }

  if (existing.data) {
    return {
      created: false,
      role: existing.data,
    };
  }

  if (!apply) {
    return {
      created: false,
      role: null,
    };
  }

  const inserted = await admin
    .from("rbac_platform_roles")
    .insert({
      code,
      is_system: true,
      title,
    })
    .select("id, code, title")
    .single();

  if (inserted.error || !inserted.data) {
    throw new Error(
      `role create failed for ${code}: ${inserted.error?.message || "unknown error"}`
    );
  }

  return {
    created: true,
    role: inserted.data,
  };
}

async function ensureActiveGrant(admin, userId, roleId, apply) {
  const existing = await admin
    .from("rbac_user_platform_roles")
    .select("id, revoked_at")
    .eq("user_id", userId)
    .eq("role_id", roleId)
    .is("revoked_at", null)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`grant lookup failed: ${existing.error.message}`);
  }

  if (existing.data?.id) {
    return {
      created: false,
      grantId: existing.data.id,
      state: "active",
    };
  }

  if (!apply) {
    return {
      created: false,
      grantId: null,
      state: "missing",
    };
  }

  const created = await admin
    .from("rbac_user_platform_roles")
    .insert({
      note: "Ops script ensured active administrative grant",
      role_id: roleId,
      user_id: userId,
    })
    .select("id")
    .single();

  if (created.error || !created.data) {
    throw new Error(`grant create failed: ${created.error?.message || "unknown error"}`);
  }

  return {
    created: true,
    grantId: created.data.id,
    state: "active",
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const admin = buildSupabaseAdminClient();
  const now = new Date().toISOString();

  const superRoleResult = await ensureRole(
    admin,
    "super_admin",
    "Super Administrator",
    options.apply
  );
  const adminRoleResult = await ensureRole(admin, "admin", "Administrator", options.apply);

  const user = await resolveUserId(admin, options.email);
  const actions = [];

  if (!user.userId) {
    actions.push({
      action: "resolve_user",
      email: options.email,
      state: "not_found",
    });
  } else {
    actions.push({
      action: "resolve_user",
      email: options.email,
      source: user.source,
      state: "found",
      userId: user.userId,
    });

    if (superRoleResult.role?.id) {
      const grant = await ensureActiveGrant(
        admin,
        user.userId,
        superRoleResult.role.id,
        options.apply
      );
      actions.push({
        action: "ensure_grant",
        created: grant.created,
        grantId: grant.grantId,
        role: "super_admin",
        state: grant.state,
      });
    }

    if (adminRoleResult.role?.id) {
      const grant = await ensureActiveGrant(
        admin,
        user.userId,
        adminRoleResult.role.id,
        options.apply
      );
      actions.push({
        action: "ensure_grant",
        created: grant.created,
        grantId: grant.grantId,
        role: "admin",
        state: grant.state,
      });
    }
  }

  const report = {
    apply: options.apply,
    generatedAt: now,
    summary: {
      adminRolePresent: Boolean(adminRoleResult.role),
      superAdminRoleCreated: superRoleResult.created,
      superAdminRolePresent: Boolean(superRoleResult.role),
      userResolved: Boolean(user.userId),
    },
    targetEmail: options.email,
    actions,
  };

  const reportPath = resolveMembershipReportPath(
    "super-admin-ensure",
    options.report
  );
  writeJsonReport(reportPath, report);

  console.log(
    JSON.stringify(
      {
        apply: options.apply,
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
          error instanceof Error ? error.message : "Unknown ensure-super-admin error",
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});

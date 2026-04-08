"use server";

import { createHmac } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppBaseUrl } from "@/lib/env";
import type { Database } from "@/lib/db/types";
import { getSupabaseAdminKey } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function encodeMessage(message: string) {
  return encodeURIComponent(message);
}

function getEmailRedirect(pathname: string) {
  return `${getAppBaseUrl()}/auth/confirm?next=${encodeURIComponent(pathname)}`;
}

function hashInvitationCode(value: string) {
  return createHmac("sha256", getSupabaseAdminKey())
    .update(value.trim().toUpperCase())
    .digest("hex");
}

type InvitationLookup = Database["public"]["Tables"]["member_invitations"]["Row"] & {
  members:
    | Pick<Database["public"]["Tables"]["members"]["Row"], "id" | "user_id">
    | Pick<Database["public"]["Tables"]["members"]["Row"], "id" | "user_id">[]
    | null;
};

export async function login(formData: FormData) {
  const email = asString(formData.get("email")).toLowerCase();
  const password = asString(formData.get("password"));
  const nextPath = asString(formData.get("next")) || "/portal";

  if (!email || !password) {
    redirect("/login?error=Email and password are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeMessage(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect(nextPath);
}

export async function requestPasswordReset(formData: FormData) {
  const email = asString(formData.get("email")).toLowerCase();

  if (!email) {
    redirect("/forgot-password?error=Email is required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getEmailRedirect("/reset-password"),
  });

  if (error) {
    redirect(`/forgot-password?error=${encodeMessage(error.message)}`);
  }

  redirect("/verify-email?message=Password recovery email sent.");
}

export async function updatePassword(formData: FormData) {
  const password = asString(formData.get("password"));
  const confirmPassword = asString(formData.get("confirmPassword"));

  if (!password) {
    redirect("/reset-password?error=New password is required.");
  }

  if (password !== confirmPassword) {
    redirect("/reset-password?error=Passwords do not match.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encodeMessage(error.message)}`);
  }

  redirect("/login?message=Password updated. Sign in with your new password.");
}

export async function claimProfile(formData: FormData) {
  const jnuitsId = asString(formData.get("jnuitsId")).toUpperCase();
  const invitationCode = asString(formData.get("invitationCode")).toUpperCase();
  const email = asString(formData.get("email")).toLowerCase();
  const password = asString(formData.get("password"));

  if (!jnuitsId || !invitationCode || !email || !password) {
    redirect("/register?error=All claim fields are required.");
  }

  const admin = createAdminClient();

  const invitationResult = await admin
    .from("member_invitations")
    .select("id, member_id, max_uses, used_count, expires_at, is_active, members!inner(id, jnuits_id, user_id)")
    .eq("code_hash", hashInvitationCode(invitationCode))
    .eq("members.jnuits_id", jnuitsId)
    .is("revoked_at", null)
    .maybeSingle();

  const invitationRow = invitationResult.data as InvitationLookup | null;
  const invitationError = invitationResult.error;

  if (invitationError || !invitationRow) {
    redirect("/register?error=Invitation code or JnUITS ID is invalid.");
  }

  if (!invitationRow.is_active) {
    redirect("/register?error=This invitation has been deactivated.");
  }

  if (invitationRow.used_count >= invitationRow.max_uses) {
    redirect("/register?error=This invitation has already been used.");
  }

  if (new Date(invitationRow.expires_at).getTime() < Date.now()) {
    redirect("/register?error=This invitation has expired.");
  }

  const linkedMember = Array.isArray(invitationRow.members)
    ? invitationRow.members[0]
    : invitationRow.members;

  if (!linkedMember) {
    redirect("/register?error=Invitation is missing its linked member.");
  }

  if (linkedMember.user_id) {
    redirect("/register?error=This member profile is already claimed.");
  }

  const supabase = await createClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getEmailRedirect("/portal"),
      data: {
        jnuits_id: jnuitsId,
        claim_source: "member_invitation",
      },
    },
  });

  if (signUpError || !signUpData.user) {
    redirect(`/register?error=${encodeMessage(signUpError?.message || "Unable to create account.")}`);
  }

  const nowIso = new Date().toISOString();

  const memberUpdate = await admin
    .from("members")
    .update({
      email,
      user_id: signUpData.user.id,
      is_profile_claimed: true,
      profile_claimed_at: nowIso,
    })
    .eq("id", linkedMember.id);

  if (memberUpdate.error) {
    redirect(`/register?error=${encodeMessage(memberUpdate.error.message)}`);
  }

  const invitationUpdate = await admin
    .from("member_invitations")
    .update({
      used_count: invitationRow.used_count + 1,
      last_used_at: nowIso,
    })
    .eq("id", invitationRow.id);

  if (invitationUpdate.error) {
    redirect(`/register?error=${encodeMessage(invitationUpdate.error.message)}`);
  }

  await admin.from("audit_events").insert({
    actor_user_id: signUpData.user.id,
    action: "member.claimed_profile",
    entity_type: "member",
    entity_id: linkedMember.id,
    metadata: {
      jnuitsId,
      invitationId: invitationRow.id,
    },
  });

  redirect(
    "/verify-email?message=Account created. Check your email for the confirmation link."
  );
}

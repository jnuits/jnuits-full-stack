import "server-only";

import { logServerError } from "@/lib/errors/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

export type OptionalEmailPreference =
  | "notification_email_opt_in"
  | "ticket_digest_opt_in";

/**
 * Returns whether an optional product email may be delivered to a user.
 * Missing preference rows use the database default of opt-in; query failures
 * fail closed so a transient database problem never overrides an opt-out.
 */
export async function allowsOptionalEmail(
  userId: string,
  preference: OptionalEmailPreference
) {
  if (!userId) {
    return false;
  }

  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin
    .from("portal_user_settings" as string)
    .select(preference)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logServerError("optional email preference lookup failed", {
      code: error.code,
      preference,
      userId,
    });
    return false;
  }

  if (!data) {
    return true;
  }

  return data[preference] === true;
}

/**
 * Resolves a verified recipient only after their optional-delivery preference
 * allows it. Auth emails remain server-side and this helper never exposes an
 * address to a browser or caller that lacks service access.
 */
export async function getOptionalEmailRecipient(
  userId: string,
  preference: OptionalEmailPreference
) {
  if (!(await allowsOptionalEmail(userId, preference))) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  const email = data.user?.email?.trim();

  if (error || !email) {
    logServerError("optional email recipient lookup failed", {
      code: error?.code,
      preference,
      userId,
    });
    return null;
  }

  return email;
}
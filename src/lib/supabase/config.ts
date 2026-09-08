export function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!value) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  }

  return value;
}

export function getSupabasePublishableKey() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!value) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required.");
  }

  return value;
}

export function getSupabaseAdminKey() {
  const value = process.env.SUPABASE_SECRET_KEY;

  if (!value) {
    throw new Error("SUPABASE_SECRET_KEY is required.");
  }

  return value;
}

export function getApplicationMacKey() {
  return getApplicationMacKeys()[0];
}

export function getApplicationMacKeys() {
  const dedicated = process.env.APP_MAC_SECRET?.trim();
  const legacy = process.env.SUPABASE_SECRET_KEY?.trim();
  const keys = [dedicated, legacy].filter(
    (value): value is string => Boolean(value)
  );

  if (keys.length === 0) {
    return [getSupabaseAdminKey()];
  }

  // New values use the dedicated application key. The former Supabase-key
  // MAC stays in the verification set so persisted invitation/directory
  // hashes and short-lived cookies survive a safe key rotation.
  return [...new Set(keys)];
}

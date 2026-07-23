import process from "node:process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const enabled = process.env.PREPRODUCTION_CONCURRENCY_TESTS === "1";

if (!enabled) {
  throw new Error(
    "Set PREPRODUCTION_CONCURRENCY_TESTS=1 only for an isolated pre-production project."
  );
}
if (!url || !secretKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required."
  );
}

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
});
const runId = randomUUID();
const eventId = randomUUID();
const slug = `concurrency-${runId}`;
const startsAt = new Date(Date.now() + 86_400_000).toISOString();
const closesAt = new Date(Date.now() + 43_200_000).toISOString();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function firstRpcRow(data) {
  return Array.isArray(data) ? data[0] : data;
}

async function register(index, email = `event-${runId}-${index}@example.test`) {
  const { data, error } = await supabase.rpc("register_for_event_atomic", {
    p_event_id: eventId,
    p_legacy_event_post_id: null,
    p_member_id: null,
    p_registrant_name: `Synthetic attendee ${index}`,
    p_registrant_email: email,
    p_registrant_phone: null,
  });
  if (error) throw error;
  const row = firstRpcRow(data);
  assert(row?.result_status, `Registration ${index} returned no status.`);
  return row;
}

try {
  const { error: eventError } = await supabase.from("events").insert({
    id: eventId,
    title: `Concurrency verification ${runId}`,
    slug,
    summary: "Synthetic pre-production capacity verification. Safe to delete.",
    category: "other-real-event",
    delivery_mode: "offline",
    status: "published",
    starts_at: startsAt,
    ends_at: startsAt,
    location_mode: "tba",
    registration_mode: "internal",
    registration_open: true,
    registration_closes_at: closesAt,
    capacity: 1,
    waitlist_enabled: true,
    source: "preproduction_verification",
    source_metadata: { synthetic: true, verificationRunId: runId },
    published_at: new Date().toISOString(),
  });
  if (eventError) throw eventError;

  const concurrent = await Promise.all(
    Array.from({ length: 12 }, (_, index) => register(index))
  );
  const confirmed = concurrent.filter((row) => row.result_status === "confirmed");
  const waitlisted = concurrent.filter((row) => row.result_status === "waitlisted");
  assert(confirmed.length === 1, `Expected one confirmed seat, received ${confirmed.length}.`);
  assert(waitlisted.length === 11, `Expected eleven waitlisted results, received ${waitlisted.length}.`);

  const duplicateEmail = `event-${runId}-0@example.test`;
  const duplicate = await register(100, duplicateEmail);
  assert(duplicate.result_status === "duplicate", "Duplicate email was not rejected atomically.");

  const { error: closeError } = await supabase
    .from("events")
    .update({ registration_open: false })
    .eq("id", eventId);
  if (closeError) throw closeError;
  const closed = await register(101);
  assert(closed.result_status === "closed", "Closed event accepted a registration.");

  const { error: fullSetupError } = await supabase
    .from("events")
    .update({ registration_open: true, waitlist_enabled: false })
    .eq("id", eventId);
  if (fullSetupError) throw fullSetupError;
  const full = await register(102);
  assert(full.result_status === "full", "Capacity-bound event did not return full.");

  const { data: registrations, error: registrationError } = await supabase
    .from("event_registrations")
    .select("registration_code, registration_status, registrant_email")
    .eq("event_id", eventId);
  if (registrationError) throw registrationError;

  const storedConfirmed = registrations.filter(
    (row) => row.registration_status === "confirmed"
  );
  assert(storedConfirmed.length === 1, "Stored registrations oversubscribed capacity.");
  assert(registrations.length === 12, "Duplicate, closed, or full outcomes created extra rows.");
  for (const registration of registrations) {
    assert(
      /^[A-F0-9]{8}$/.test(registration.registration_code),
      "Registration code is not the expected opaque random token."
    );
    assert(
      !registration.registration_code.includes("@") &&
        !registration.registration_code.includes(registration.registrant_email),
      "Registration code contains registrant PII."
    );
  }

  console.log(
    JSON.stringify({
      eventId,
      outcomes: { confirmed: confirmed.length, waitlisted: waitlisted.length },
      runId,
      verified: ["capacity", "closed", "concurrency", "duplicate", "opaque-code", "waitlist"],
    })
  );
} finally {
  const { error: registrationCleanupError } = await supabase
    .from("event_registrations")
    .delete()
    .eq("event_id", eventId);
  const { error: eventCleanupError } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId);
  if (registrationCleanupError || eventCleanupError) {
    console.error("Synthetic concurrency-test cleanup requires attention.", {
      eventCleanup: eventCleanupError?.message,
      eventId,
      registrationCleanup: registrationCleanupError?.message,
    });
    process.exitCode = 1;
  }
}

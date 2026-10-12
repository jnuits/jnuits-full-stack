-- New member profiles are public unless their creator explicitly chooses otherwise.
-- This changes only the default. It never resets an existing member opt-out.
-- The owner-authorized one-time publication is recorded separately as an operation.
alter table public.members alter column professional_visibility set default 'public';

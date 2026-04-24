-- Event registration writes are handled by the guarded API route using the
-- server-side admin client. Do not allow direct public table inserts.

drop policy if exists "event_registrations public register"
on public.event_registrations;

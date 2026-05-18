-- Notices continue to use public.content_posts with content_type = 'notice'.
-- Keep explicit Data API grants in migrations so Supabase's grant enforcement
-- change does not break public notice reads or authenticated operator writes.

grant select on public.content_posts to anon, authenticated;
grant insert, update, delete on public.content_posts to authenticated;
grant all on public.content_posts to service_role;

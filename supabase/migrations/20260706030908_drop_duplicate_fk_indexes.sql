begin;

-- Remove duplicate indexes introduced by the first-wave FK index migration where
-- an older covering index already existed. The existing indexes listed by the
-- Supabase advisor remain in place and continue to cover the foreign keys.
drop index if exists public.audit_events_actor_user_id_fk_idx;
drop index if exists public.certificate_import_batches_created_by_user_id_fk_idx;
drop index if exists public.event_registrations_event_id_fk_idx;
drop index if exists public.event_registrations_event_post_id_fk_idx;
drop index if exists public.media_assets_created_by_user_id_fk_idx;
drop index if exists public.member_invitations_created_by_user_id_fk_idx;
drop index if exists public.members_user_id_fk_idx;
drop index if exists public.operator_reports_created_by_user_id_fk_idx;
drop index if exists public.profile_update_requests_reviewed_by_user_id_fk_idx;

commit;
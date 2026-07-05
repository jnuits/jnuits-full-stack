begin;

-- First-wave FK indexes for release-critical operational paths.
-- This intentionally avoids a blanket index rollout. Remaining advisor items
-- should be handled table-by-table after traffic and query patterns are clearer.

-- Media and gallery are the largest current public/content datasets.
create index if not exists media_assets_created_by_user_id_fk_idx on public.media_assets (created_by_user_id);
create index if not exists media_assets_deleted_by_user_id_fk_idx on public.media_assets (deleted_by_user_id);
create index if not exists gallery_album_items_album_id_fk_idx on public.gallery_album_items (album_id);
create index if not exists gallery_album_items_created_by_user_id_fk_idx on public.gallery_album_items (created_by_user_id);
create index if not exists gallery_album_items_deleted_by_user_id_fk_idx on public.gallery_album_items (deleted_by_user_id);
create index if not exists gallery_albums_cover_item_id_fk_idx on public.gallery_albums (cover_item_id);
create index if not exists gallery_albums_created_by_user_id_fk_idx on public.gallery_albums (created_by_user_id);
create index if not exists gallery_albums_deleted_by_user_id_fk_idx on public.gallery_albums (deleted_by_user_id);

-- Certificate import staging is directly tied to the certificate launch path.
create index if not exists certificate_import_batches_created_by_user_id_fk_idx on public.certificate_import_batches (created_by_user_id);
create index if not exists certificates_import_staging_import_batch_id_fk_idx on public.certificates_import_staging (import_batch_id);

-- Member/admin invitation and profile moderation paths must scale for onboarding.
create index if not exists admin_invitations_accepted_by_user_id_fk_idx on public.admin_invitations (accepted_by_user_id);
create index if not exists admin_invitations_claim_invitation_id_fk_idx on public.admin_invitations (claim_invitation_id);
create index if not exists admin_invitations_invited_by_user_id_fk_idx on public.admin_invitations (invited_by_user_id);
create index if not exists admin_invitations_revoked_by_user_id_fk_idx on public.admin_invitations (revoked_by_user_id);
create index if not exists admin_invitations_target_admin_profile_id_fk_idx on public.admin_invitations (target_admin_profile_id);
create index if not exists admin_invitations_target_user_id_fk_idx on public.admin_invitations (target_user_id);
create index if not exists member_invitations_batch_id_fk_idx on public.member_invitations (batch_id);
create index if not exists member_invitations_created_by_user_id_fk_idx on public.member_invitations (created_by_user_id);
create index if not exists member_invitations_member_id_fk_idx on public.member_invitations (member_id);
create index if not exists member_invitations_revoked_by_user_id_fk_idx on public.member_invitations (revoked_by_user_id);
create index if not exists members_department_code_fk_idx on public.members (department_code);
create index if not exists members_user_id_fk_idx on public.members (user_id);
create index if not exists profile_update_requests_member_id_fk_idx on public.profile_update_requests (member_id);
create index if not exists profile_update_requests_reviewed_by_user_id_fk_idx on public.profile_update_requests (reviewed_by_user_id);
create index if not exists profile_update_requests_submitted_by_user_id_fk_idx on public.profile_update_requests (submitted_by_user_id);

-- Audit/security/event ownership joins are common admin investigation paths.
create index if not exists audit_events_actor_user_id_fk_idx on public.audit_events (actor_user_id);
create index if not exists security_events_actor_user_id_fk_idx on public.security_events (actor_user_id);
create index if not exists security_events_target_user_id_fk_idx on public.security_events (target_user_id);
create index if not exists operator_reports_created_by_user_id_fk_idx on public.operator_reports (created_by_user_id);
create index if not exists events_cover_media_asset_id_fk_idx on public.events (cover_media_asset_id);
create index if not exists events_created_by_user_id_fk_idx on public.events (created_by_user_id);
create index if not exists events_legacy_content_post_id_fk_idx on public.events (legacy_content_post_id);
create index if not exists event_registrations_event_id_fk_idx on public.event_registrations (event_id);
create index if not exists event_registrations_event_post_id_fk_idx on public.event_registrations (event_post_id);
create index if not exists event_registrations_member_id_fk_idx on public.event_registrations (member_id);

commit;
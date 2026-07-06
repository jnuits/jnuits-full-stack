begin;

-- Second-wave FK indexes for remaining Supabase advisor findings after the
-- release-critical first wave. These are direct covering indexes for foreign
-- keys that still had no covering index.
create index if not exists advisor_profiles_created_by_user_id_fk_idx on public.advisor_profiles (created_by_user_id);
create index if not exists blog_review_events_reviewer_user_id_fk_idx on public.blog_review_events (reviewer_user_id);
create index if not exists committee_assignments_rollover_source_assignment_id_fk_idx on public.committee_assignments (rollover_source_assignment_id);
create index if not exists committee_terms_rollover_source_term_id_fk_idx on public.committee_terms (rollover_source_term_id);
create index if not exists contact_settings_updated_by_fk_idx on public.contact_settings (updated_by);
create index if not exists invitation_batches_cycle_id_fk_idx on public.invitation_batches (cycle_id);
create index if not exists invitation_email_deliveries_created_by_user_id_fk_idx on public.invitation_email_deliveries (created_by_user_id);
create index if not exists mentorship_messages_author_user_id_fk_idx on public.mentorship_messages (author_user_id);
create index if not exists mentorship_relationships_created_by_user_id_fk_idx on public.mentorship_relationships (created_by_user_id);
create index if not exists portal_user_settings_member_id_fk_idx on public.portal_user_settings (member_id);
create index if not exists projects_created_by_user_id_fk_idx on public.projects (created_by_user_id);
create index if not exists rbac_role_permissions_permission_code_fk_idx on public.rbac_role_permissions (permission_code);
create index if not exists security_settings_updated_by_user_id_fk_idx on public.security_settings (updated_by_user_id);
create index if not exists support_ticket_events_actor_user_id_fk_idx on public.support_ticket_events (actor_user_id);
create index if not exists support_ticket_messages_author_user_id_fk_idx on public.support_ticket_messages (author_user_id);
create index if not exists support_tickets_member_id_fk_idx on public.support_tickets (member_id);

commit;
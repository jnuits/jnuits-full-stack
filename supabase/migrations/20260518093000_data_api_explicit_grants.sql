-- Supabase Data API explicit grants.
--
-- Supabase is removing automatic Data API grants for new public-schema objects.
-- Keep grants explicit for tables/sequences that were previously relying on
-- project defaults while preserving RLS as the authorization boundary.

grant usage on schema public to anon, authenticated, service_role;

-- Public-facing inserts/reads protected by RLS policies.
grant select, insert on public.event_registrations to anon, authenticated;
grant update on public.event_registrations to authenticated;

-- Public project showcase reads; writes remain authenticated and RLS-gated.
grant select on public.projects to anon, authenticated;
grant insert, update, delete on public.projects to authenticated;
grant select on public.project_contributors to anon, authenticated;
grant insert, update, delete on public.project_contributors to authenticated;

-- RBAC support tables are readable only through authenticated RLS policies.
grant select on public.rbac_permissions to authenticated;
grant select on public.rbac_role_permissions to authenticated;
grant select on public.rbac_user_claim_versions to authenticated;

-- Portal self-service tables.
grant select, insert, update on public.portal_user_settings to authenticated;
grant select, insert on public.security_events to authenticated;
grant select, insert, update on public.support_tickets to authenticated;
grant select, insert on public.support_ticket_messages to authenticated;
grant select, insert on public.support_ticket_events to authenticated;
grant select, insert, update on public.mentorship_profiles to authenticated;
grant select, insert, update on public.mentorship_relationships to authenticated;
grant select, insert on public.mentorship_messages to authenticated;
grant select, insert on public.blog_review_events to authenticated;

-- Security settings are read/write only for authenticated security admins via RLS.
grant select, update on public.security_settings to authenticated;

-- Service role keeps full Data API access for server actions and admin jobs.
grant select, insert, update, delete on public.event_registrations to service_role;
grant select, insert, update, delete on public.projects to service_role;
grant select, insert, update, delete on public.project_contributors to service_role;
grant select, insert, update, delete on public.rbac_permissions to service_role;
grant select, insert, update, delete on public.rbac_role_permissions to service_role;
grant select, insert, update, delete on public.rbac_user_claim_versions to service_role;
grant select, insert, update, delete on public.portal_user_settings to service_role;
grant select, insert, update, delete on public.security_events to service_role;
grant select, insert, update, delete on public.support_tickets to service_role;
grant select, insert, update, delete on public.support_ticket_messages to service_role;
grant select, insert, update, delete on public.support_ticket_events to service_role;
grant select, insert, update, delete on public.mentorship_profiles to service_role;
grant select, insert, update, delete on public.mentorship_relationships to service_role;
grant select, insert, update, delete on public.mentorship_messages to service_role;
grant select, insert, update, delete on public.blog_review_events to service_role;
grant select, insert, update, delete on public.security_settings to service_role;

-- Advisor ID allocation sequences used by advisor profile inserts.
grant usage, select on sequence public.advisor_ca_id_seq to authenticated, service_role;
grant usage, select on sequence public.advisor_mod_id_seq to authenticated, service_role;
grant usage, select on sequence public.advisor_ra_id_seq to authenticated, service_role;

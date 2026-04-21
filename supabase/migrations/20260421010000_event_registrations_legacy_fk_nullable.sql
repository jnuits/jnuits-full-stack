set check_function_bodies = off;
set search_path = public;

alter table public.event_registrations
  alter column event_post_id drop not null;

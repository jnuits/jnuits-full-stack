alter table public.members
  add column if not exists facebook_url text;

comment on column public.members.facebook_url is
  'Optional public Facebook profile URL for member and alumni directory profiles.';

-- Advisor public speeches for About and Homepage.
-- The project stores advisor records in public.advisor_profiles.

alter table public.advisor_profiles
  add column if not exists speech text,
  add column if not exists speech_updated_at timestamptz default timezone('utc', now());

create or replace function public.update_advisor_speech_timestamp()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.speech is distinct from old.speech then
    new.speech_updated_at = timezone('utc', now());
  end if;

  return new;
end;
$$;

drop trigger if exists advisor_profiles_speech_timestamp on public.advisor_profiles;
create trigger advisor_profiles_speech_timestamp
before update on public.advisor_profiles
for each row
execute function public.update_advisor_speech_timestamp();

create index if not exists idx_advisor_profiles_is_current
  on public.advisor_profiles (is_current);

create index if not exists advisor_profiles_current_speech_idx
  on public.advisor_profiles (advisor_type, sort_order)
  where is_current = true
    and is_public = true
    and speech is not null
    and btrim(speech) <> '';

alter table public.advisor_profiles enable row level security;

grant select on public.advisor_profiles to anon, authenticated;
grant update on public.advisor_profiles to authenticated;

drop policy if exists "advisor profiles current speech public read" on public.advisor_profiles;
create policy "advisor profiles current speech public read"
on public.advisor_profiles
for select
to anon, authenticated
using (
  is_public = true
  and is_current = true
  and speech is not null
  and btrim(speech) <> ''
);

drop policy if exists "advisor profiles own read" on public.advisor_profiles;
create policy "advisor profiles own read"
on public.advisor_profiles
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "advisor profiles own update" on public.advisor_profiles;
create policy "advisor profiles own update"
on public.advisor_profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

update public.advisor_profiles
set speech_updated_at = coalesce(speech_updated_at, updated_at, timezone('utc', now()))
where speech is not null
  and btrim(speech) <> '';

update public.advisor_profiles
set
  speech = 'Jagannath University has always stood for academic excellence and community service. JnUITS embodies this spirit by equipping students with modern technology skills that extend far beyond the classroom. I am proud to support a society that bridges the gap between academic learning and the demands of the digital world. I encourage every student to engage with JnUITS and invest in their own future.',
  speech_updated_at = timezone('utc', now())
where advisor_jnuits_id = 'JNUITS-CA0006'
  or (
    advisor_type = 'main_advisor'
    and is_current = true
    and lower(full_name) like '%rais%'
  );

update public.advisor_profiles
set
  speech = 'Technology is not just a skill - it is a language that shapes the future. Through JnUITS, I have witnessed students transform their curiosity into capability, their ideas into impact. This society is more than a club; it is a community where students learn to lead, collaborate, and innovate. My message to every member: be consistent, be curious, and never stop building. The work you do here will define not just your career, but the technological future of Bangladesh.',
  speech_updated_at = timezone('utc', now())
where advisor_jnuits_id = 'JNUITS-MOD0002'
  or (
    advisor_type = 'moderator_mentor'
    and is_current = true
    and lower(full_name) like '%layek%'
  );

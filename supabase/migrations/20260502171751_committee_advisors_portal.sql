-- Committee/advisor workspace foundation.
-- Separates teacher advisors from student/alumni members, enriches committee
-- term/role metadata, allows advisor-authored blogs, and tightens committee
-- management policies to canonical RBAC permissions.

alter table public.committee_terms
  add column if not exists term_number integer,
  add column if not exists term_kind text not null default 'executive',
  add column if not exists election_date date,
  add column if not exists is_current boolean not null default false,
  add column if not exists date_confidence text not null default 'verified',
  add column if not exists tenure_note text,
  add column if not exists target_executive_slots integer not null default 21,
  add column if not exists voter_rule_note text;

alter table public.committee_terms
  drop constraint if exists committee_terms_term_kind_check,
  add constraint committee_terms_term_kind_check
    check (term_kind = any (array['executive', 'advisor_board'])),
  drop constraint if exists committee_terms_date_confidence_check,
  add constraint committee_terms_date_confidence_check
    check (date_confidence = any (array['verified', 'estimated'])),
  drop constraint if exists committee_terms_target_executive_slots_check,
  add constraint committee_terms_target_executive_slots_check
    check (target_executive_slots between 1 and 60);

create unique index if not exists committee_terms_one_current_executive_idx
  on public.committee_terms (is_current)
  where is_current = true and term_kind = 'executive';

create index if not exists committee_terms_kind_current_idx
  on public.committee_terms (term_kind, is_current, starts_on desc);

alter table public.committee_roles
  add column if not exists title_bn text,
  add column if not exists aliases text[] not null default '{}'::text[],
  add column if not exists role_group text not null default 'executive',
  add column if not exists min_slots integer not null default 1,
  add column if not exists max_slots integer not null default 1,
  add column if not exists default_slots integer not null default 1;

alter table public.committee_roles
  drop constraint if exists committee_roles_role_group_check,
  add constraint committee_roles_role_group_check
    check (role_group = any (array['executive', 'advisor', 'sub_executive'])),
  drop constraint if exists committee_roles_slot_range_check,
  add constraint committee_roles_slot_range_check
    check (min_slots >= 0 and max_slots >= min_slots and default_slots between min_slots and max_slots);

create index if not exists committee_roles_group_sort_idx
  on public.committee_roles (role_group, sort_order, code);

alter table public.committee_assignments
  add column if not exists public_title_override text,
  add column if not exists is_public boolean not null default true,
  add column if not exists source text not null default 'admin',
  add column if not exists import_batch_id uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.committee_assignments
  drop constraint if exists committee_assignments_source_check,
  add constraint committee_assignments_source_check
    check (source = any (array['admin', 'legacy_import', 'bulk_import', 'rollover', 'system']));

create index if not exists committee_assignments_public_term_idx
  on public.committee_assignments (term_id, is_public, status, sort_order);

create table if not exists public.advisor_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid null unique references auth.users(id) on delete set null,
  advisor_type text not null default 'honorable_advisor',
  full_name text not null,
  title text,
  department text,
  designation text,
  email text,
  phone text,
  avatar_public_id text,
  avatar_secure_url text,
  speech text,
  bio text,
  work_experience jsonb not null default '[]'::jsonb,
  publications jsonb not null default '[]'::jsonb,
  facebook_url text,
  linkedin_url text,
  website_url text,
  joined_on date,
  left_on date,
  is_current boolean not null default true,
  is_public boolean not null default true,
  sort_order integer not null default 100,
  created_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (left_on is null or joined_on is null or left_on >= joined_on)
);

alter table public.advisor_profiles
  drop constraint if exists advisor_profiles_type_check,
  add constraint advisor_profiles_type_check
    check (advisor_type = any (array['main_advisor', 'moderator_mentor', 'honorable_advisor']));

create index if not exists advisor_profiles_public_current_idx
  on public.advisor_profiles (is_public, is_current, sort_order, full_name);

create index if not exists advisor_profiles_user_idx
  on public.advisor_profiles (user_id)
  where user_id is not null;

drop trigger if exists advisor_profiles_set_updated_at on public.advisor_profiles;
create trigger advisor_profiles_set_updated_at
before update on public.advisor_profiles
for each row execute function public.set_current_timestamp_updated_at();

alter table public.content_posts
  add column if not exists author_advisor_profile_id uuid null references public.advisor_profiles(id) on delete set null;

create index if not exists content_posts_author_advisor_idx
  on public.content_posts (author_advisor_profile_id, content_type, status, updated_at desc)
  where author_advisor_profile_id is not null;

alter table public.content_posts
  drop constraint if exists content_posts_single_blog_author_check,
  add constraint content_posts_single_blog_author_check
    check (
      content_type <> 'blog'
      or num_nonnulls(author_member_id, author_advisor_profile_id) <= 1
    );

insert into public.rbac_platform_roles (
  code,
  title,
  display_name,
  scope,
  rank,
  is_hidden,
  is_assignable,
  is_system
)
values
  ('advisor', 'Advisor', 'Advisor', 'portal', 260, false, true, true)
on conflict (code) do update
set
  title = excluded.title,
  display_name = excluded.display_name,
  scope = excluded.scope,
  rank = excluded.rank,
  is_hidden = excluded.is_hidden,
  is_assignable = excluded.is_assignable,
  is_system = excluded.is_system;

with advisor_role_permissions (permission_code) as (
  values
    ('portal.profile.manage_self'),
    ('portal.blogs.submit')
)
insert into public.rbac_role_permissions (role_id, permission_code)
select roles.id, advisor_role_permissions.permission_code
from advisor_role_permissions
join public.rbac_platform_roles as roles
  on roles.code = 'advisor'
on conflict (role_id, permission_code) do nothing;

update public.committee_roles
set
  title = data.title,
  title_bn = data.title_bn,
  aliases = data.aliases,
  role_group = data.role_group,
  min_slots = data.min_slots,
  max_slots = data.max_slots,
  default_slots = data.default_slots,
  sort_order = data.sort_order,
  is_executive = data.role_group = 'executive',
  is_public = data.role_group <> 'sub_executive'
from (
  values
    ('president', 'President', 'সভাপতি', array[]::text[], 'executive', 1, 1, 1, 10),
    ('vice-president', 'Vice President', 'সহ-সভাপতি', array[]::text[], 'executive', 2, 3, 3, 20),
    ('general-secretary', 'General Secretary', 'সাধারণ সম্পাদক', array[]::text[], 'executive', 1, 1, 1, 30),
    ('assistant-general-secretary', 'Assistant General Secretary', 'সহ-সাধারণ সম্পাদক', array['Joint Secretary']::text[], 'executive', 2, 3, 2, 40),
    ('organizing-secretary', 'Organizing Secretary', 'সাংগঠনিক সম্পাদক', array[]::text[], 'executive', 1, 1, 1, 50),
    ('treasurer', 'Treasurer', 'অর্থ সম্পাদক', array[]::text[], 'executive', 1, 1, 1, 60),
    ('office-secretary', 'Office Secretary', 'দপ্তর সম্পাদক', array[]::text[], 'executive', 1, 1, 1, 70),
    ('workshop-secretary', 'Workshop Secretary', 'কর্মশালা সম্পাদক', array[]::text[], 'executive', 1, 1, 1, 80),
    ('it-secretary', 'Information and Technology Secretary', 'তথ্য ও প্রযুক্তি সম্পাদক', array['IT Secretary']::text[], 'executive', 1, 1, 1, 90),
    ('publication-secretary', 'Publication Secretary', 'প্রকাশনা সম্পাদক', array[]::text[], 'executive', 1, 1, 1, 100),
    ('public-relations-secretary', 'Publicity and Public Relations Secretary', 'প্রচার ও জনসংযোগ সম্পাদক', array['Public Relations Secretary']::text[], 'executive', 1, 1, 1, 110),
    ('education-research-secretary', 'Education and Research Secretary', 'শিক্ষা ও গবেষণা সম্পাদক', array['Edu & Research Secretary']::text[], 'executive', 1, 1, 1, 120),
    ('international-secretary', 'International Secretary', 'আন্তর্জাতিক সম্পাদক', array['International Affairs Secretary']::text[], 'executive', 1, 1, 1, 130),
    ('executive-member', 'Executive Member', 'কার্যনির্বাহী সদস্য', array['Executive']::text[], 'executive', 4, 6, 4, 140),
    ('chief-advisor', 'Main Advisor', 'প্রধান উপদেষ্টা', array['Chief Advisor']::text[], 'advisor', 1, 1, 1, 10),
    ('mentor-moderator', 'Moderator / Mentor', 'মডারেটর / মেন্টর', array['Mentor / Moderator']::text[], 'advisor', 1, 1, 1, 20),
    ('respected-advisor', 'Honorable Advisor', 'সম্মানিত উপদেষ্টা', array['Respected Advisor']::text[], 'advisor', 0, 10, 3, 30),
    ('sub-executive-member', 'Sub-Executive Member', 'উপ-কার্যনির্বাহী সদস্য', array['Sub-Executive']::text[], 'sub_executive', 0, 99, 12, 900)
) as data(code, title, title_bn, aliases, role_group, min_slots, max_slots, default_slots, sort_order)
where public.committee_roles.code = data.code;

insert into public.committee_roles (
  code,
  title,
  title_bn,
  aliases,
  role_group,
  min_slots,
  max_slots,
  default_slots,
  sort_order,
  is_executive,
  is_public
)
select
  data.code,
  data.title,
  data.title_bn,
  data.aliases,
  data.role_group,
  data.min_slots,
  data.max_slots,
  data.default_slots,
  data.sort_order,
  data.role_group = 'executive',
  data.role_group <> 'sub_executive'
from (
  values
    ('president', 'President', 'সভাপতি', array[]::text[], 'executive', 1, 1, 1, 10),
    ('vice-president', 'Vice President', 'সহ-সভাপতি', array[]::text[], 'executive', 2, 3, 3, 20),
    ('general-secretary', 'General Secretary', 'সাধারণ সম্পাদক', array[]::text[], 'executive', 1, 1, 1, 30),
    ('assistant-general-secretary', 'Assistant General Secretary', 'সহ-সাধারণ সম্পাদক', array['Joint Secretary']::text[], 'executive', 2, 3, 2, 40),
    ('organizing-secretary', 'Organizing Secretary', 'সাংগঠনিক সম্পাদক', array[]::text[], 'executive', 1, 1, 1, 50),
    ('treasurer', 'Treasurer', 'অর্থ সম্পাদক', array[]::text[], 'executive', 1, 1, 1, 60),
    ('office-secretary', 'Office Secretary', 'দপ্তর সম্পাদক', array[]::text[], 'executive', 1, 1, 1, 70),
    ('workshop-secretary', 'Workshop Secretary', 'কর্মশালা সম্পাদক', array[]::text[], 'executive', 1, 1, 1, 80),
    ('it-secretary', 'Information and Technology Secretary', 'তথ্য ও প্রযুক্তি সম্পাদক', array['IT Secretary']::text[], 'executive', 1, 1, 1, 90),
    ('publication-secretary', 'Publication Secretary', 'প্রকাশনা সম্পাদক', array[]::text[], 'executive', 1, 1, 1, 100),
    ('public-relations-secretary', 'Publicity and Public Relations Secretary', 'প্রচার ও জনসংযোগ সম্পাদক', array['Public Relations Secretary']::text[], 'executive', 1, 1, 1, 110),
    ('education-research-secretary', 'Education and Research Secretary', 'শিক্ষা ও গবেষণা সম্পাদক', array['Edu & Research Secretary']::text[], 'executive', 1, 1, 1, 120),
    ('international-secretary', 'International Secretary', 'আন্তর্জাতিক সম্পাদক', array['International Affairs Secretary']::text[], 'executive', 1, 1, 1, 130),
    ('executive-member', 'Executive Member', 'কার্যনির্বাহী সদস্য', array['Executive']::text[], 'executive', 4, 6, 4, 140),
    ('chief-advisor', 'Main Advisor', 'প্রধান উপদেষ্টা', array['Chief Advisor']::text[], 'advisor', 1, 1, 1, 10),
    ('mentor-moderator', 'Moderator / Mentor', 'মডারেটর / মেন্টর', array['Mentor / Moderator']::text[], 'advisor', 1, 1, 1, 20),
    ('respected-advisor', 'Honorable Advisor', 'সম্মানিত উপদেষ্টা', array['Respected Advisor']::text[], 'advisor', 0, 10, 3, 30),
    ('sub-executive-member', 'Sub-Executive Member', 'উপ-কার্যনির্বাহী সদস্য', array['Sub-Executive']::text[], 'sub_executive', 0, 99, 12, 900)
) as data(code, title, title_bn, aliases, role_group, min_slots, max_slots, default_slots, sort_order)
where not exists (
  select 1 from public.committee_roles where committee_roles.code = data.code
);

delete from public.committee_assignments
where term_id in (
  select id
  from public.committee_terms
  where slug in ('5th-committee', 'advisory-committee')
);

delete from public.committee_terms
where slug in ('5th-committee', 'advisory-committee');

update public.committee_terms
set is_current = false
where term_kind = 'executive'
  and slug <> '6th-executive-committee';

insert into public.committee_terms (
  slug,
  title,
  summary,
  starts_on,
  ends_on,
  status,
  is_public,
  term_number,
  term_kind,
  election_date,
  is_current,
  date_confidence,
  tenure_note,
  target_executive_slots,
  voter_rule_note
)
values
  ('founding-executive-committee', 'Founding Executive Committee', 'Founding executive committee archive for JnU IT Society.', '2015-11-11', '2016-12-31', 'archived', true, 1, 'executive', null, false, 'estimated', 'Only the start date, 11 Nov 2015, is confirmed in current notes. End date is inferred to keep the estimated 2nd EC 2017 start non-overlapping and must be verified from official records.', 21, 'Historical voter records are retained as metadata only.'),
  ('2nd-executive-committee', '2nd Executive Committee', 'Second executive committee archive for JnU IT Society.', '2017-01-01', '2019-09-16', 'archived', true, 2, 'executive', null, false, 'estimated', 'Source notes say the 2nd EC started in 2017 and ended on 16 Sep 2019. Stored start date uses 1 Jan 2017 until official handover records are verified.', 21, 'Historical voter records are retained as metadata only.'),
  ('3rd-executive-committee', '3rd Executive Committee', 'Third executive committee archive for JnU IT Society.', '2019-09-16', '2022-02-24', 'archived', true, 3, 'executive', null, false, 'verified', null, 21, 'Historical voter records are retained as metadata only.'),
  ('4th-executive-committee', '4th Executive Committee', 'Fourth executive committee archive for JnU IT Society.', '2022-02-24', '2023-07-16', 'archived', true, 4, 'executive', null, false, 'verified', null, 21, 'Historical voter records are retained as metadata only.'),
  ('5th-executive-committee', '5th Executive Committee', 'Fifth executive committee archive for JnU IT Society. Roster will be bulk-imported after validation.', '2023-07-16', '2025-07-07', 'archived', true, 5, 'executive', '2023-07-15', false, 'estimated', 'Source notes mention both 15 Jul 2023 and 16 Jul 2023 around the 5th EC handover. Stored tenure starts 16 Jul 2023, with election date kept as 15 Jul 2023 until official records confirm the exact handover.', 21, 'Previous executive and sub-executive voter data is metadata-only in this phase.'),
  ('6th-executive-committee', '6th Executive Committee', 'Current executive committee of JnU IT Society.', '2025-07-07', null, 'active', true, 6, 'executive', '2025-07-07', true, 'verified', null, 21, 'Elected by the prior executive committee and eligible sub-executive members; voting module is out of scope.')
on conflict (slug) do update
set
  title = excluded.title,
  summary = excluded.summary,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  status = excluded.status,
  is_public = excluded.is_public,
  term_number = excluded.term_number,
  term_kind = excluded.term_kind,
  election_date = excluded.election_date,
  is_current = excluded.is_current,
  date_confidence = excluded.date_confidence,
  tenure_note = excluded.tenure_note,
  target_executive_slots = excluded.target_executive_slots,
  voter_rule_note = excluded.voter_rule_note;

do $$
declare
  missing_terms text[];
begin
  select array_agg(expected.slug order by expected.term_number)
  into missing_terms
  from (
    values
      (1, 'founding-executive-committee'),
      (2, '2nd-executive-committee'),
      (3, '3rd-executive-committee'),
      (4, '4th-executive-committee'),
      (5, '5th-executive-committee'),
      (6, '6th-executive-committee')
  ) as expected(term_number, slug)
  left join public.committee_terms as terms
    on terms.slug = expected.slug
   and terms.term_number = expected.term_number
   and terms.term_kind = 'executive'
  where terms.id is null;

  if missing_terms is not null then
    raise exception 'Committee tenure seed missing expected executive terms: %', missing_terms;
  end if;

  if (
    select count(*)
    from public.committee_terms
    where term_kind = 'executive'
      and is_current = true
  ) <> 1 then
    raise exception 'Committee tenure seed must leave exactly one current executive committee.';
  end if;

  if not exists (
    select 1
    from public.committee_terms
    where slug = '6th-executive-committee'
      and is_current = true
      and status = 'active'
      and starts_on = date '2025-07-07'
      and election_date = date '2025-07-07'
      and ends_on is null
  ) then
    raise exception '6th Executive Committee tenure seed is not current/open-ended as expected.';
  end if;
end
$$;

alter table public.advisor_profiles enable row level security;

grant select on public.advisor_profiles to anon, authenticated;
grant insert, update, delete on public.advisor_profiles to authenticated;

drop policy if exists "advisor profiles public read" on public.advisor_profiles;
create policy "advisor profiles public read"
on public.advisor_profiles
for select
to anon, authenticated
using (is_public = true);

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

drop policy if exists "advisor profiles committee admin manage" on public.advisor_profiles;
create policy "advisor profiles committee admin manage"
on public.advisor_profiles
for all
to authenticated
using (public.has_permission('admin.committee.manage'))
with check (public.has_permission('admin.committee.manage'));

drop policy if exists "committee terms operator write" on public.committee_terms;
create policy "committee terms committee admin manage"
on public.committee_terms
for all
to authenticated
using (public.has_permission('admin.committee.manage'))
with check (public.has_permission('admin.committee.manage'));

drop policy if exists "committee roles operator write" on public.committee_roles;
create policy "committee roles committee admin manage"
on public.committee_roles
for all
to authenticated
using (public.has_permission('admin.committee.manage'))
with check (public.has_permission('admin.committee.manage'));

drop policy if exists "committee assignments public read" on public.committee_assignments;
create policy "committee assignments public read"
on public.committee_assignments
for select
to anon, authenticated
using (
  status <> 'planned'
  and is_public = true
  and exists (
    select 1
    from public.committee_terms
    where public.committee_terms.id = committee_assignments.term_id
      and public.committee_terms.is_public = true
      and public.committee_terms.status in ('upcoming', 'active', 'archived')
  )
  and exists (
    select 1
    from public.committee_roles
    where public.committee_roles.id = committee_assignments.role_id
      and public.committee_roles.is_public = true
      and public.committee_roles.role_group = 'executive'
  )
);

drop policy if exists "committee assignments operator write" on public.committee_assignments;
create policy "committee assignments committee admin manage"
on public.committee_assignments
for all
to authenticated
using (public.has_permission('admin.committee.manage'))
with check (public.has_permission('admin.committee.manage'));

drop policy if exists "content posts author select" on public.content_posts;
create policy "content posts author select"
on public.content_posts
for select
to authenticated
using (
  content_type = 'blog'
  and (
    author_member_id = public.current_member_id()
    or exists (
      select 1
      from public.advisor_profiles
      where advisor_profiles.id = content_posts.author_advisor_profile_id
        and advisor_profiles.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "content posts author insert" on public.content_posts;
create policy "content posts author insert"
on public.content_posts
for insert
to authenticated
with check (
  content_type = 'blog'
  and public.has_permission('portal.blogs.submit')
  and status in ('draft', 'pending_review', 'change_requested')
  and (
    author_member_id = public.current_member_id()
    or exists (
      select 1
      from public.advisor_profiles
      where advisor_profiles.id = content_posts.author_advisor_profile_id
        and advisor_profiles.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "content posts author update" on public.content_posts;
create policy "content posts author update"
on public.content_posts
for update
to authenticated
using (
  content_type = 'blog'
  and (
    author_member_id = public.current_member_id()
    or exists (
      select 1
      from public.advisor_profiles
      where advisor_profiles.id = content_posts.author_advisor_profile_id
        and advisor_profiles.user_id = (select auth.uid())
    )
  )
)
with check (
  content_type = 'blog'
  and public.has_permission('portal.blogs.submit')
  and status in ('draft', 'pending_review', 'change_requested')
  and (
    author_member_id = public.current_member_id()
    or exists (
      select 1
      from public.advisor_profiles
      where advisor_profiles.id = content_posts.author_advisor_profile_id
        and advisor_profiles.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "blog review events select access" on public.blog_review_events;
create policy "blog review events select access"
on public.blog_review_events
for select
to authenticated
using (
  public.has_permission('cms.blogs.review')
  or exists (
    select 1
    from public.content_posts as posts
    where posts.id = blog_review_events.post_id
      and (
        posts.author_member_id = public.current_member_id()
        or exists (
          select 1
          from public.advisor_profiles
          where advisor_profiles.id = posts.author_advisor_profile_id
            and advisor_profiles.user_id = (select auth.uid())
        )
      )
  )
);

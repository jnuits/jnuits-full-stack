-- Manual provisioning script for RBAC portal testing.
-- Execute this in the Supabase SQL Editor.
--
-- Test credentials created by this script:
--   Super Admin: jnuitsbd@gmail.com / SuperAdmin#2026!
--   Portal User: contact@redwan.work / Member#2026!

begin;

do $$
declare
  super_admin_user_id uuid := gen_random_uuid();
  super_admin_member_id uuid := gen_random_uuid();
  portal_user_id uuid := gen_random_uuid();
  portal_member_id uuid := gen_random_uuid();
  super_admin_role_id uuid;
  member_role_id uuid;
  test_user_ids uuid[] := array[]::uuid[];
  test_user_id_texts text[] := array[]::text[];
begin
  select id
  into super_admin_role_id
  from public.rbac_platform_roles
  where code = 'super_admin';

  if super_admin_role_id is null then
    raise exception 'Canonical role "super_admin" is missing. Apply the RBAC migrations first.';
  end if;

  select id
  into member_role_id
  from public.rbac_platform_roles
  where code = 'member';

  if member_role_id is null then
    raise exception 'Canonical role "member" is missing. Apply the RBAC migrations first.';
  end if;

  select coalesce(array_agg(id), array[]::uuid[])
  into test_user_ids
  from auth.users
  where lower(email) in ('jnuitsbd@gmail.com', 'contact@redwan.work');

  select coalesce(array_agg(value::text), array[]::text[])
  into test_user_id_texts
  from unnest(test_user_ids) as ids(value);

  delete from public.rbac_user_platform_roles
  where user_id = any(test_user_ids);

  delete from public.members
  where user_id = any(test_user_ids)
     or lower(coalesce(email, '')) in ('jnuitsbd@gmail.com', 'contact@redwan.work')
     or upper(jnuits_id) in ('JNUITS-ADMIN-0001', 'JNUITS-2023001');

  if array_length(test_user_ids, 1) is not null then
    if to_regclass('auth.mfa_challenges') is not null
       and to_regclass('auth.mfa_factors') is not null then
      execute
        'delete from auth.mfa_challenges
          where factor_id in (
            select id from auth.mfa_factors where user_id = any($1)
          )'
      using test_user_ids;
    end if;

    if to_regclass('auth.mfa_factors') is not null then
      execute
        'delete from auth.mfa_factors where user_id = any($1)'
      using test_user_ids;
    end if;

    if to_regclass('auth.one_time_tokens') is not null then
      execute
        'delete from auth.one_time_tokens where user_id = any($1)'
      using test_user_ids;
    end if;

    if to_regclass('auth.refresh_tokens') is not null
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'auth'
           and table_name = 'refresh_tokens'
           and column_name = 'user_id'
       ) then
      execute
        'delete from auth.refresh_tokens where user_id::text = any($1)'
      using test_user_id_texts;
    end if;

    if to_regclass('auth.sessions') is not null then
      execute
        'delete from auth.sessions where user_id = any($1)'
      using test_user_ids;
    end if;
  end if;

  delete from auth.identities
  where user_id = any(test_user_ids);

  delete from auth.users
  where lower(email) in ('jnuitsbd@gmail.com', 'contact@redwan.work');

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000'::uuid,
    super_admin_user_id,
    'authenticated',
    'authenticated',
    'jnuitsbd@gmail.com',
    crypt('SuperAdmin#2026!', gen_salt('bf')),
    timezone('utc', now()),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'jnuits_admin_role', 'super_admin',
      'jnuits_portal_role', null,
      'jnuits_portals', jsonb_build_array('admin'),
      'jnuits_member_id', super_admin_member_id::text,
      'role_scope', 'admin'
    ),
    jsonb_build_object(
      'first_name', 'Jagannath University',
      'last_name', 'IT Society',
      'display_name', 'Jagannath University IT Society',
      'jnuits_id', 'JNUITS-ADMIN-0001'
    ),
    timezone('utc', now()),
    timezone('utc', now()),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    created_at,
    updated_at,
    last_sign_in_at
  )
  values (
    gen_random_uuid(),
    super_admin_user_id,
    jsonb_build_object(
      'sub', super_admin_user_id::text,
      'email', 'jnuitsbd@gmail.com',
      'email_verified', true,
      'first_name', 'Jagannath University',
      'last_name', 'IT Society'
    ),
    'email',
    super_admin_user_id::text,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into public.members (
    id,
    first_name,
    last_name,
    full_name,
    email,
    jnuits_id,
    member_type,
    user_id,
    is_profile_claimed,
    profile_claimed_at
  )
  values (
    super_admin_member_id,
    'Jagannath University',
    'IT Society',
    'Jagannath University IT Society',
    'jnuitsbd@gmail.com',
    'JNUITS-ADMIN-0001',
    'current',
    super_admin_user_id,
    true,
    timezone('utc', now())
  );

  insert into public.rbac_user_platform_roles (
    user_id,
    role_id,
    scope,
    note
  )
  values (
    super_admin_user_id,
    super_admin_role_id,
    'admin',
    'Manual RBAC test provisioning: bootstrap super admin.'
  );

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000'::uuid,
    portal_user_id,
    'authenticated',
    'authenticated',
    'contact@redwan.work',
    crypt('Member#2026!', gen_salt('bf')),
    timezone('utc', now()),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'jnuits_admin_role', null,
      'jnuits_portal_role', 'member',
      'jnuits_portals', jsonb_build_array('portal'),
      'jnuits_member_id', portal_member_id::text,
      'role_scope', 'portal'
    ),
    jsonb_build_object(
      'first_name', 'Redwan',
      'last_name', 'Ahmed',
      'display_name', 'Redwan Ahmed',
      'jnuits_id', 'JNUITS-2023001'
    ),
    timezone('utc', now()),
    timezone('utc', now()),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    created_at,
    updated_at,
    last_sign_in_at
  )
  values (
    gen_random_uuid(),
    portal_user_id,
    jsonb_build_object(
      'sub', portal_user_id::text,
      'email', 'contact@redwan.work',
      'email_verified', true,
      'first_name', 'Redwan',
      'last_name', 'Ahmed'
    ),
    'email',
    portal_user_id::text,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into public.members (
    id,
    first_name,
    last_name,
    full_name,
    email,
    jnuits_id,
    student_id,
    member_type,
    user_id,
    is_profile_claimed,
    profile_claimed_at
  )
  values (
    portal_member_id,
    'Redwan',
    'Ahmed',
    'Redwan Ahmed',
    'contact@redwan.work',
    'JNUITS-2023001',
    'JNUITS-2023001',
    'current',
    portal_user_id,
    true,
    timezone('utc', now())
  );

  insert into public.rbac_user_platform_roles (
    user_id,
    role_id,
    scope,
    note
  )
  values (
    portal_user_id,
    member_role_id,
    'portal',
    'Manual RBAC test provisioning: canonical member account.'
  );
end
$$;

commit;

select
  users.email,
  users.raw_user_meta_data ->> 'first_name' as first_name,
  users.raw_user_meta_data ->> 'last_name' as last_name,
  users.raw_app_meta_data ->> 'jnuits_admin_role' as app_admin_role,
  users.raw_app_meta_data ->> 'jnuits_portal_role' as app_portal_role,
  roles.code as rbac_role_code,
  roles.scope as rbac_scope,
  members.full_name,
  members.first_name,
  members.last_name,
  members.jnuits_id
from auth.users as users
left join public.rbac_user_platform_roles as grants
  on grants.user_id = users.id
 and grants.revoked_at is null
left join public.rbac_platform_roles as roles
  on roles.id = grants.role_id
left join public.members as members
  on members.user_id = users.id
where lower(users.email) in ('jnuitsbd@gmail.com', 'contact@redwan.work')
order by users.email, roles.scope;

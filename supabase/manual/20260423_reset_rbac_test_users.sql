-- Manual provisioning script for RBAC portal testing.
-- Execute this in the Supabase SQL Editor or through the Supabase MCP.
--
-- This script is intentionally non-destructive for existing auth users:
-- - it preserves existing MFA factors and sessions where possible
-- - it resets the listed test passwords
-- - it syncs Auth user metadata, members, identities, and canonical RBAC roles
--
-- Test credentials created by this script:
--   Super Admin: jnuitsbd@gmail.com / SuperAdmin#2026!
--   Admin: redwanse@outlook.com / NormalAdmin#2026!
--   Content Admin: dev.redwan@gmail.com / ContentAdmin#2026!
--   Portal User (Current): contact@redwan.work / Member#2026!
--   Portal User (Alumni): info@redwan.work / Member#2026!

begin;

do $$
declare
  seed record;
  resolved_user_id uuid;
  resolved_member_id uuid;
  resolved_role_id uuid;
begin
  for seed in
    select *
    from (
      values
        (
          'jnuitsbd@gmail.com',
          'SuperAdmin#2026!',
          'Jagannath University',
          'IT Society',
          'Jagannath University IT Society',
          'JNUITS-ADMIN-0001',
          null::text,
          null::integer,
          'current',
          'super_admin',
          'admin',
          'super_admin'::text,
          null::text,
          jsonb_build_array('admin'),
          'Manual RBAC test provisioning: bootstrap super admin.'
        ),
        (
          'redwanse@outlook.com',
          'NormalAdmin#2026!',
          'Redwan',
          'Admin',
          'Redwan Admin',
          'JNUITS-ADMIN-0002',
          null::text,
          null::integer,
          'current',
          'admin',
          'admin',
          'admin'::text,
          null::text,
          jsonb_build_array('admin'),
          'Manual RBAC test provisioning: canonical admin account.'
        ),
        (
          'dev.redwan@gmail.com',
          'ContentAdmin#2026!',
          'Redwan',
          'Content Admin',
          'Redwan Content Admin',
          'JNUITS-ADMIN-0003',
          null::text,
          null::integer,
          'current',
          'content_admin',
          'admin',
          'content_admin'::text,
          null::text,
          jsonb_build_array('admin'),
          'Manual RBAC test provisioning: canonical content admin account.'
        ),
        (
          'contact@redwan.work',
          'Member#2026!',
          'Redwan',
          'Ahmed',
          'Redwan Ahmed',
          'JNUITS-2023001',
          'JNUITS-2023001',
          null::integer,
          'current',
          'member',
          'portal',
          null::text,
          'member'::text,
          jsonb_build_array('portal'),
          'Manual RBAC test provisioning: canonical current member account.'
        ),
        (
          'info@redwan.work',
          'Member#2026!',
          'Redwan',
          'Alumni',
          'Redwan Alumni',
          'JNUITS-ALUMNI-0001',
          'JNUITS-ALUMNI-0001',
          2022,
          'alumni',
          'alumni',
          'portal',
          null::text,
          'alumni'::text,
          jsonb_build_array('portal'),
          'Manual RBAC test provisioning: canonical alumni account.'
        )
    ) as seeds(
      email,
      password,
      first_name,
      last_name,
      display_name,
      jnuits_id,
      student_id,
      graduation_year,
      member_type,
      role_code,
      role_scope,
      admin_role,
      portal_role,
      portals,
      role_note
    )
  loop
    select id
    into resolved_role_id
    from public.rbac_platform_roles
    where code = seed.role_code
      and scope = seed.role_scope;

    if resolved_role_id is null then
      raise exception 'Canonical role "%" in scope "%" is missing. Apply RBAC migrations first.',
        seed.role_code,
        seed.role_scope;
    end if;

    select id
    into resolved_user_id
    from auth.users
    where lower(email) = lower(seed.email)
    order by created_at nulls last
    limit 1;

    if resolved_user_id is null then
      resolved_user_id := gen_random_uuid();

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
        resolved_user_id,
        'authenticated',
        'authenticated',
        lower(seed.email),
        crypt(seed.password, gen_salt('bf')),
        timezone('utc', now()),
        jsonb_build_object(
          'provider', 'email',
          'providers', jsonb_build_array('email'),
          'jnuits_admin_role', seed.admin_role,
          'jnuits_portal_role', seed.portal_role,
          'jnuits_portals', seed.portals,
          'role_scope', seed.role_scope
        ),
        jsonb_build_object(
          'first_name', seed.first_name,
          'last_name', seed.last_name,
          'display_name', seed.display_name,
          'jnuits_id', seed.jnuits_id
        ),
        timezone('utc', now()),
        timezone('utc', now()),
        '',
        '',
        '',
        ''
      );
    else
      update auth.users
      set
        aud = 'authenticated',
        role = 'authenticated',
        email = lower(seed.email),
        encrypted_password = crypt(seed.password, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, timezone('utc', now())),
        raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
          || jsonb_build_object(
            'provider', 'email',
            'providers', jsonb_build_array('email'),
            'jnuits_admin_role', seed.admin_role,
            'jnuits_portal_role', seed.portal_role,
            'jnuits_portals', seed.portals,
            'role_scope', seed.role_scope
          ),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
          || jsonb_build_object(
            'first_name', seed.first_name,
            'last_name', seed.last_name,
            'display_name', seed.display_name,
            'jnuits_id', seed.jnuits_id
          ),
        updated_at = timezone('utc', now())
      where id = resolved_user_id;
    end if;

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
      resolved_user_id,
      jsonb_build_object(
        'sub', resolved_user_id::text,
        'email', lower(seed.email),
        'email_verified', true,
        'first_name', seed.first_name,
        'last_name', seed.last_name
      ),
      'email',
      resolved_user_id::text,
      timezone('utc', now()),
      timezone('utc', now()),
      timezone('utc', now())
    )
    on conflict (provider_id, provider) do update
    set
      user_id = excluded.user_id,
      identity_data = excluded.identity_data,
      updated_at = timezone('utc', now());

    select id
    into resolved_member_id
    from public.members
    where user_id = resolved_user_id
       or lower(coalesce(email::text, '')) = lower(seed.email)
       or upper(jnuits_id::text) = upper(seed.jnuits_id)
    order by created_at nulls last
    limit 1;

    if resolved_member_id is null then
      resolved_member_id := gen_random_uuid();

      insert into public.members (
        id,
        first_name,
        last_name,
        full_name,
        email,
        jnuits_id,
        student_id,
        graduation_year,
        member_type,
        user_id,
        is_profile_claimed,
        profile_claimed_at
      )
      values (
        resolved_member_id,
        seed.first_name,
        seed.last_name,
        seed.display_name,
        lower(seed.email),
        seed.jnuits_id,
        seed.student_id,
        seed.graduation_year,
        seed.member_type,
        resolved_user_id,
        true,
        timezone('utc', now())
      );
    else
      update public.members
      set
        first_name = seed.first_name,
        last_name = seed.last_name,
        full_name = seed.display_name,
        email = lower(seed.email),
        jnuits_id = seed.jnuits_id,
        student_id = seed.student_id,
        graduation_year = seed.graduation_year,
        member_type = seed.member_type,
        user_id = resolved_user_id,
        is_profile_claimed = true,
        profile_claimed_at = coalesce(profile_claimed_at, timezone('utc', now())),
        updated_at = timezone('utc', now())
      where id = resolved_member_id;
    end if;

    update auth.users
    set
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('jnuits_member_id', resolved_member_id::text),
      updated_at = timezone('utc', now())
    where id = resolved_user_id;

    update public.rbac_user_platform_roles
    set
      revoked_at = timezone('utc', now()),
      note = concat_ws(
        E'\n',
        nullif(note, ''),
        'Revoked by manual RBAC test provisioning because canonical role changed to: ' || seed.role_code
      )
    where user_id = resolved_user_id
      and scope = seed.role_scope
      and revoked_at is null
      and role_id <> resolved_role_id;

    insert into public.rbac_user_platform_roles (
      user_id,
      role_id,
      scope,
      note
    )
    select
      resolved_user_id,
      resolved_role_id,
      seed.role_scope,
      seed.role_note
    where not exists (
      select 1
      from public.rbac_user_platform_roles
      where user_id = resolved_user_id
        and role_id = resolved_role_id
        and scope = seed.role_scope
        and revoked_at is null
    );
  end loop;
end
$$;

commit;

select
  users.email,
  users.raw_user_meta_data ->> 'first_name' as first_name,
  users.raw_user_meta_data ->> 'last_name' as last_name,
  users.raw_app_meta_data ->> 'jnuits_admin_role' as app_admin_role,
  users.raw_app_meta_data ->> 'jnuits_portal_role' as app_portal_role,
  users.raw_app_meta_data -> 'jnuits_portals' as app_portals,
  roles.code as rbac_role_code,
  roles.scope as rbac_scope,
  roles.is_hidden,
  members.full_name,
  members.first_name as member_first_name,
  members.last_name as member_last_name,
  members.member_type,
  members.jnuits_id,
  members.student_id,
  members.graduation_year
from auth.users as users
left join public.rbac_user_platform_roles as grants
  on grants.user_id = users.id
 and grants.revoked_at is null
left join public.rbac_platform_roles as roles
  on roles.id = grants.role_id
left join public.members as members
  on members.user_id = users.id
where lower(users.email) in (
  'jnuitsbd@gmail.com',
  'redwanse@outlook.com',
  'dev.redwan@gmail.com',
  'contact@redwan.work',
  'info@redwan.work'
)
order by users.email, roles.scope;

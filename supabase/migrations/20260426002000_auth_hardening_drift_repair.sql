-- Repair live auth-hardening drift discovered before membership lifecycle work.
-- Keeps admin MFA enforcement on and restricts member-claim finalization to
-- service-role callers only.

update public.security_settings
set
  admin_totp_enforced = true,
  updated_at = timezone('utc', now())
where id = true
  and admin_totp_enforced is distinct from true;

create or replace function public.finalize_member_invitation_claim(
  target_user_id uuid,
  target_email text,
  target_member_id uuid,
  target_invitation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_record public.members%rowtype;
  invitation_record public.member_invitations%rowtype;
  role_id uuid;
  role_code text;
  now_value timestamptz := timezone('utc', now());
  newly_claimed boolean := false;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only service-role callers can finalize member invitation claims.'
      using errcode = '42501';
  end if;

  if target_user_id is null or target_email is null or target_member_id is null or target_invitation_id is null then
    raise exception 'Missing claim finalization input.';
  end if;

  select *
    into member_record
  from public.members
  where id = target_member_id
  for update;

  if not found then
    raise exception 'Member profile was not found.';
  end if;

  if member_record.user_id is not null and member_record.user_id <> target_user_id then
    raise exception 'This member profile is already claimed.';
  end if;

  select *
    into invitation_record
  from public.member_invitations
  where id = target_invitation_id
    and member_id = target_member_id
  for update;

  if not found then
    raise exception 'Invitation was not found.';
  end if;

  if not invitation_record.is_active or invitation_record.revoked_at is not null then
    raise exception 'This invitation is no longer active.';
  end if;

  if invitation_record.used_count >= invitation_record.max_uses
    and member_record.user_id is distinct from target_user_id
  then
    raise exception 'This invitation has already been used.';
  end if;

  if invitation_record.expires_at < now_value then
    raise exception 'This invitation has expired.';
  end if;

  if member_record.user_id is null then
    newly_claimed := true;

    update public.members
    set
      email = target_email,
      user_id = target_user_id,
      is_profile_claimed = true,
      profile_claimed_at = now_value,
      updated_at = now_value
    where id = target_member_id;

    update public.member_invitations
    set
      used_count = used_count + 1,
      last_used_at = now_value,
      updated_at = now_value
    where id = target_invitation_id;
  else
    update public.members
    set
      email = target_email,
      is_profile_claimed = true,
      updated_at = now_value
    where id = target_member_id;
  end if;

  role_code := case
    when member_record.member_type = 'alumni' then 'alumni'
    else 'member'
  end;

  select id
    into role_id
  from public.rbac_platform_roles
  where code = role_code
    and scope = 'portal'
  limit 1;

  if role_id is null then
    raise exception 'Portal role % is not configured.', role_code;
  end if;

  insert into public.rbac_user_platform_roles (
    user_id,
    role_id,
    note
  )
  select target_user_id, role_id, 'Granted after verified member invitation claim.'
  where not exists (
    select 1
    from public.rbac_user_platform_roles as grants
    where grants.user_id = target_user_id
      and grants.scope = 'portal'
      and grants.revoked_at is null
  );

  insert into public.security_events (
    actor_user_id,
    target_user_id,
    event_type,
    severity,
    payload
  )
  values (
    target_user_id,
    target_user_id,
    case when newly_claimed then 'member.profile_claim_finalized' else 'member.profile_claim_refreshed' end,
    'info',
    jsonb_build_object(
      'member_id', target_member_id,
      'invitation_id', target_invitation_id,
      'role_code', role_code
    )
  );

  return jsonb_build_object(
    'member_id', target_member_id,
    'newly_claimed', newly_claimed,
    'role_code', role_code
  );
end;
$$;

revoke all on function public.finalize_member_invitation_claim(uuid, text, uuid, uuid) from public;
revoke all on function public.finalize_member_invitation_claim(uuid, text, uuid, uuid) from anon;
revoke all on function public.finalize_member_invitation_claim(uuid, text, uuid, uuid) from authenticated;
grant execute on function public.finalize_member_invitation_claim(uuid, text, uuid, uuid) to service_role;

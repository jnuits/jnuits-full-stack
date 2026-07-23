-- Local-only until explicit migration approval. Reconcile alumni identity,
-- reactivate safely, and issue a canonical claim in one transaction.

begin;

create or replace function public.approve_alumni_onboarding_case(
  p_case_id uuid,
  p_actor_user_id uuid,
  p_invitation_code_hash text,
  p_invitation_expires_at timestamptz,
  p_review_note text
)
returns table (
  result_status text,
  member_id uuid,
  invitation_id uuid,
  jnuits_id text,
  recipient_email text
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  onboarding public.alumni_onboarding_cases%rowtype;
  member_by_email public.members%rowtype;
  member_by_id public.members%rowtype;
  member public.members%rowtype;
  invitation public.member_invitations%rowtype;
  normalized_email text;
  normalized_jnuits_id text;
  now_value timestamptz := clock_timestamp();
begin
  if p_case_id is null
    or p_actor_user_id is null
    or coalesce(trim(p_invitation_code_hash), '') = ''
    or p_invitation_expires_at <= now_value
  then
    return query select 'invalid'::text, null::uuid, null::uuid, null::text, null::text;
    return;
  end if;

  select * into onboarding
  from public.alumni_onboarding_cases
  where id = p_case_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid, null::text, null::text;
    return;
  end if;

  if onboarding.status = 'approved' and onboarding.processed_member_id is not null then
    select * into member from public.members
    where id = onboarding.processed_member_id;
    return query select 'already_approved'::text, member.id,
      onboarding.invitation_id, member.jnuits_id::text, member.email::text;
    return;
  end if;

  if onboarding.status <> 'pending' then
    return query select 'already_processed'::text, null::uuid, null::uuid, null::text, null::text;
    return;
  end if;

  normalized_email := lower(trim(coalesce(onboarding.email::text, '')));
  normalized_jnuits_id := nullif(upper(trim(coalesce(onboarding.jnuits_id, ''))), '');
  if normalized_email = '' then
    return query select 'invalid'::text, null::uuid, null::uuid, null::text, null::text;
    return;
  end if;

  select * into member_by_email
  from public.members
  where email is not null and lower(trim(email::text)) = normalized_email
  order by created_at asc
  limit 1
  for update;

  if normalized_jnuits_id is not null then
    select * into member_by_id
    from public.members
    where upper(trim(jnuits_id::text)) = normalized_jnuits_id
    limit 1
    for update;
  end if;

  if member_by_email.id is not null
    and member_by_id.id is not null
    and member_by_email.id <> member_by_id.id
  then
    return query select 'identity_conflict'::text, null::uuid, null::uuid, null::text, null::text;
    return;
  end if;

  member := coalesce(member_by_id, member_by_email);

  -- Alumni onboarding must never downgrade a current member.
  if member.id is not null
    and (member.lifecycle_status = 'current' or member.member_type = 'current')
  then
    return query select 'current_member'::text, member.id, null::uuid,
      member.jnuits_id::text, member.email::text;
    return;
  end if;

  if member.id is null then
    if normalized_jnuits_id is null then
      normalized_jnuits_id := public.allocate_membership_id(
        to_char(now_value at time zone 'Asia/Dhaka', 'YYYY')
      );
    end if;

    insert into public.members (
      email,
      full_name,
      jnuits_id,
      lifecycle_changed_at,
      lifecycle_note,
      lifecycle_status,
      member_type,
      portal_access_status,
      professional_visibility
    ) values (
      normalized_email,
      coalesce(nullif(trim(onboarding.full_name), ''), 'JnUITS alumni'),
      normalized_jnuits_id,
      now_value,
      'Created through approved alumni onboarding.',
      'alumni',
      'alumni',
      'active',
      'members-only'
    ) returning * into member;
  else
    update public.members
    set email = coalesce(email, normalized_email),
        lifecycle_changed_at = now_value,
        lifecycle_note = 'Reactivated through approved alumni onboarding.',
        lifecycle_status = 'alumni',
        member_type = 'alumni',
        portal_access_status = 'active',
        updated_at = now_value
    where id = member.id
    returning * into member;
  end if;

  -- Claimed alumni accounts are reactivated directly. Unclaimed identities get
  -- one canonical invitation and no automatic auth account provisioning.
  if member.user_id is null then
    insert into public.member_invitations (
      member_id,
      code_hash,
      expires_at,
      max_uses,
      notes,
      created_by_user_id
    ) values (
      member.id,
      p_invitation_code_hash,
      p_invitation_expires_at,
      1,
      nullif(trim(p_review_note), ''),
      p_actor_user_id
    ) returning * into invitation;
  end if;

  update public.alumni_onboarding_cases
  set status = 'approved',
      review_note = nullif(trim(p_review_note), ''),
      reviewed_at = now_value,
      reviewed_by_user_id = p_actor_user_id,
      processed_member_id = member.id,
      invitation_id = invitation.id,
      updated_at = now_value
  where id = onboarding.id;

  update public.form_submissions
  set review_status = 'approved',
      reviewed_at = now_value,
      reviewed_by_user_id = p_actor_user_id,
      updated_at = now_value
  where id = onboarding.form_submission_id
    and review_status in ('unreviewed', 'in_review');

  insert into public.membership_lifecycle_events (
    member_id, event_type, summary, metadata, created_by_user_id
  ) values (
    member.id,
    'alumni_onboarding_approved',
    'Alumni onboarding approved and canonical identity reconciled.',
    jsonb_build_object(
      'alumniCaseId', onboarding.id,
      'invitationId', invitation.id,
      'reactivatedExisting', member_by_email.id is not null or member_by_id.id is not null
    ),
    p_actor_user_id
  );

  insert into public.audit_events (
    action, actor_user_id, entity_id, entity_type, metadata
  ) values (
    'alumni.onboarding_approved',
    p_actor_user_id,
    onboarding.id,
    'alumni_onboarding_case',
    jsonb_build_object(
      'memberId', member.id,
      'invitationId', invitation.id,
      'jnuitsId', member.jnuits_id
    )
  );

  return query select
    case when invitation.id is null then 'reactivated' else 'approved' end,
    member.id,
    invitation.id,
    member.jnuits_id::text,
    member.email::text;
end;
$function$;

create or replace function public.reject_alumni_onboarding_case(
  p_case_id uuid,
  p_actor_user_id uuid,
  p_review_note text
)
returns table (result_status text)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  onboarding public.alumni_onboarding_cases%rowtype;
  now_value timestamptz := clock_timestamp();
begin
  select * into onboarding
  from public.alumni_onboarding_cases
  where id = p_case_id
  for update;

  if not found then
    return query select 'not_found'::text;
    return;
  end if;

  if onboarding.status = 'rejected' then
    return query select 'already_rejected'::text;
    return;
  end if;

  if onboarding.status <> 'pending' then
    return query select 'already_processed'::text;
    return;
  end if;

  update public.alumni_onboarding_cases
  set status = 'rejected',
      review_note = nullif(trim(p_review_note), ''),
      reviewed_at = now_value,
      reviewed_by_user_id = p_actor_user_id,
      updated_at = now_value
  where id = onboarding.id;

  update public.form_submissions
  set review_status = 'rejected',
      reviewed_at = now_value,
      reviewed_by_user_id = p_actor_user_id,
      updated_at = now_value
  where id = onboarding.form_submission_id
    and review_status in ('unreviewed', 'in_review');

  insert into public.audit_events (
    action, actor_user_id, entity_id, entity_type, metadata
  ) values (
    'alumni.onboarding_rejected',
    p_actor_user_id,
    onboarding.id,
    'alumni_onboarding_case',
    jsonb_build_object('reviewNote', nullif(trim(p_review_note), ''))
  );

  return query select 'rejected'::text;
end;
$function$;

revoke all on function public.approve_alumni_onboarding_case(
  uuid, uuid, text, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.approve_alumni_onboarding_case(
  uuid, uuid, text, timestamptz, text
) to service_role;

revoke all on function public.reject_alumni_onboarding_case(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reject_alumni_onboarding_case(uuid, uuid, text)
  to service_role;

commit;

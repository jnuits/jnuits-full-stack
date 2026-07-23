-- Local-only until explicit migration approval. Reconcile identity, enroll the
-- member, issue the canonical claim, and finalize approval in one transaction.

begin;

create or replace function public.approve_membership_application(
  p_application_id uuid,
  p_actor_user_id uuid,
  p_invitation_code_hash text,
  p_invitation_expires_at timestamptz,
  p_review_note text
)
returns table (
  result_status text,
  member_id uuid,
  invitation_id uuid,
  jnuits_id text
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  application public.membership_applications%rowtype;
  member public.members%rowtype;
  invitation public.member_invitations%rowtype;
  normalized_email text;
  normalized_student_id text;
  next_jnuits_id text;
  now_value timestamptz := clock_timestamp();
begin
  if p_application_id is null
    or p_actor_user_id is null
    or coalesce(trim(p_invitation_code_hash), '') = ''
    or p_invitation_expires_at <= now_value
  then
    return query select 'invalid'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  select * into application
  from public.membership_applications
  where id = p_application_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  if application.status = 'approved'
    and application.processed_member_id is not null
    and application.invitation_id is not null
  then
    select * into member from public.members
    where id = application.processed_member_id;
    return query select 'already_approved'::text, member.id,
      application.invitation_id, member.jnuits_id::text;
    return;
  end if;

  if application.status not in ('pending', 'needs_review') then
    return query select 'already_processed'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  if application.membership_cycle_id is null then
    raise exception 'Application is not bound to an annual membership cycle.';
  end if;

  normalized_email := lower(trim(application.email::text));
  normalized_student_id := nullif(lower(trim(coalesce(application.student_id, ''))), '');

  if application.processed_member_id is not null then
    select * into member from public.members
    where id = application.processed_member_id
    for update;
  end if;

  if member.id is null then
    select * into member
    from public.members
    where email is not null and lower(trim(email::text)) = normalized_email
    order by created_at asc
    limit 1
    for update;
  end if;

  if member.id is null and normalized_student_id is not null then
    select * into member
    from public.members
    where student_id is not null
      and lower(trim(student_id)) = normalized_student_id
    order by created_at asc
    limit 1
    for update;
  end if;

  if member.id is null then
    next_jnuits_id := public.allocate_membership_id(
      to_char(now_value at time zone 'Asia/Dhaka', 'YYYY')
    );

    insert into public.members (
      jnuits_id,
      full_name,
      email,
      phone,
      department_code,
      batch_no,
      student_id,
      lifecycle_status,
      member_type,
      portal_access_status,
      professional_visibility,
      facebook_url,
      linkedin_url
    )
    values (
      next_jnuits_id,
      application.name,
      normalized_email,
      application.phone,
      application.department_code,
      case when coalesce(application.batch_label, '') ~ '[0-9]+'
        then substring(application.batch_label from '[0-9]+')::integer
        else null end,
      normalized_student_id,
      'current',
      'current',
      'active',
      'members-only',
      application.facebook_url,
      application.linkedin_url
    )
    returning * into member;
  else
    update public.members
    set email = coalesce(email, normalized_email),
        phone = coalesce(phone, application.phone),
        student_id = coalesce(student_id, normalized_student_id),
        updated_at = now_value
    where id = member.id
    returning * into member;
  end if;

  insert into public.membership_cycle_memberships (
    cycle_id,
    member_id,
    state,
    enrolled_at,
    created_by_user_id,
    note
  )
  values (
    application.membership_cycle_id,
    member.id,
    'active',
    now_value,
    p_actor_user_id,
    'Enrolled from approved annual membership application.'
  )
  on conflict (cycle_id, member_id) do update
  set state = 'active',
      renewed_at = case
        when public.membership_cycle_memberships.state <> 'active' then now_value
        else public.membership_cycle_memberships.renewed_at end,
      updated_at = now_value;

  insert into public.member_invitations (
    member_id,
    code_hash,
    expires_at,
    max_uses,
    notes,
    created_by_user_id
  )
  values (
    member.id,
    p_invitation_code_hash,
    p_invitation_expires_at,
    1,
    nullif(trim(p_review_note), ''),
    p_actor_user_id
  )
  returning * into invitation;

  update public.membership_applications
  set status = 'approved',
      review_note = nullif(trim(p_review_note), ''),
      reviewed_at = now_value,
      reviewed_by_user_id = p_actor_user_id,
      processed_member_id = member.id,
      invitation_id = invitation.id,
      updated_at = now_value
  where id = application.id;

  insert into public.membership_lifecycle_events (
    member_id,
    event_type,
    summary,
    metadata,
    created_by_user_id
  )
  values (
    member.id,
    'application_approved',
    'Annual membership application approved and claim invitation issued.',
    jsonb_build_object(
      'applicationId', application.id,
      'cycleId', application.membership_cycle_id,
      'invitationId', invitation.id
    ),
    p_actor_user_id
  );

  insert into public.audit_events (
    action,
    actor_user_id,
    entity_id,
    entity_type,
    metadata
  )
  values (
    'membership.application_approved',
    p_actor_user_id,
    application.id,
    'membership_application',
    jsonb_build_object(
      'memberId', member.id,
      'cycleId', application.membership_cycle_id,
      'invitationId', invitation.id,
      'jnuitsId', member.jnuits_id
    )
  );

  return query select 'approved'::text, member.id, invitation.id,
    member.jnuits_id::text;
end;
$function$;

create or replace function public.review_membership_application(
  p_application_id uuid,
  p_actor_user_id uuid,
  p_target_status text,
  p_review_note text
)
returns table (result_status text, application_status text)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  application public.membership_applications%rowtype;
  now_value timestamptz := clock_timestamp();
begin
  if p_actor_user_id is null
    or p_target_status not in ('pending', 'needs_review', 'rejected')
  then
    return query select 'invalid'::text, null::text;
    return;
  end if;

  select * into application
  from public.membership_applications
  where id = p_application_id
  for update;

  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;

  if application.status in ('approved', 'rejected') then
    return query select 'already_processed'::text, application.status;
    return;
  end if;

  update public.membership_applications
  set status = p_target_status,
      review_note = nullif(trim(p_review_note), ''),
      reviewed_at = case when p_target_status = 'rejected' then now_value else null end,
      reviewed_by_user_id = p_actor_user_id,
      updated_at = now_value
  where id = application.id;

  insert into public.audit_events (
    action, actor_user_id, entity_id, entity_type, metadata
  ) values (
    'membership.application_' || p_target_status,
    p_actor_user_id,
    application.id,
    'membership_application',
    jsonb_build_object('reviewNote', nullif(trim(p_review_note), ''))
  );

  return query select 'updated'::text, p_target_status;
end;
$function$;

revoke all on function public.approve_membership_application(
  uuid, uuid, text, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.approve_membership_application(
  uuid, uuid, text, timestamptz, text
) to service_role;

revoke all on function public.review_membership_application(
  uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.review_membership_application(
  uuid, uuid, text, text
) to service_role;

commit;

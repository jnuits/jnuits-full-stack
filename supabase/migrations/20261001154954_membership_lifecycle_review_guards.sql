-- Forward-only review fixes; earlier migration history stays unchanged.
begin;
set local lock_timeout = '5s';

create or replace function private.initialize_member_anniversary()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' or new.joined_on is distinct from old.joined_on then
    if new.joined_on > (now() at time zone 'Asia/Dhaka')::date then
      raise exception 'Joining date cannot be in the future.' using errcode = '22023';
    end if;
    if tg_op = 'UPDATE' and exists (select 1 from public.membership_renewals where member_id = old.id) then
      raise exception 'A joining date with renewal history requires an audited correction.' using errcode = '22023';
    end if;
    new.renewal_due_on := case when new.joined_on is null then null
      else public.membership_anniversary(new.joined_on, extract(year from new.joined_on)::integer + 1) end;
  end if;
  if tg_op = 'INSERT' or new.lifecycle_status is distinct from old.lifecycle_status then
    if new.lifecycle_status = 'alumni' then
      new.current_membership_path_status := 'closed_final';
      new.current_membership_closure_reason := 'alumni_conversion';
      new.current_membership_closed_on := coalesce(new.alumni_since, (now() at time zone 'Asia/Dhaka')::date);
      new.current_membership_closed_by_user_id := auth.uid();
      if tg_op = 'UPDATE' then new.portal_access_status := old.portal_access_status; end if;
    elsif tg_op = 'UPDATE' and new.lifecycle_status = 'current' then
      if new.current_membership_path_status <> 'open' then
        raise exception 'Closed current membership cannot be reactivated directly.' using errcode = '22023';
      end if;
      if old.lifecycle_status = 'former' and
         (new.renewal_due_on is null or new.renewal_due_on <= (now() at time zone 'Asia/Dhaka')::date) then
        raise exception 'Confirm all outstanding anniversaries in the renewal queue before reactivating membership.' using errcode = '22023';
      end if;
    end if;
  end if;
  if tg_op = 'UPDATE' and (
    new.joined_on is distinct from old.joined_on or new.renewal_due_on is distinct from old.renewal_due_on
    or new.lifecycle_status is distinct from old.lifecycle_status or new.portal_access_status is distinct from old.portal_access_status
    or new.current_membership_path_status is distinct from old.current_membership_path_status
    or new.current_membership_case_id is distinct from old.current_membership_case_id
    or new.current_membership_appeal_id is distinct from old.current_membership_appeal_id
  ) then new.membership_revision := old.membership_revision + 1; end if;
  return new;
end;
$function$;

-- Historical receipt dates never decide present-day portal eligibility.
create or replace function public.confirm_membership_renewal(
  p_member_id uuid, p_expected_due_on date, p_resolution text,
  p_reference text default null, p_note text default null,
  p_effective_date date default (now() at time zone 'Asia/Dhaka')::date
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  actor_id uuid := private.require_membership_operator();
  person public.members%rowtype; confirmed public.membership_renewals%rowtype;
  next_due date; next_lifecycle text;
  present_date date := (now() at time zone 'Asia/Dhaka')::date;
begin
  if p_resolution is null or p_resolution not in ('paid', 'waived') or p_effective_date is null
    or p_effective_date > (now() at time zone 'Asia/Dhaka')::date
    or length(coalesce(p_note, '')) > 500 or length(coalesce(p_reference, '')) > 96
    or (nullif(btrim(p_reference), '') is not null and p_reference !~ '^[A-Za-z0-9._/-]+$') then
    raise exception 'Invalid confirmation date, resolution, safe reference, or note.' using errcode = '22023';
  end if;
  select * into person from public.members where id = p_member_id for update;
  if not found then raise exception 'Member not found.' using errcode = 'P0002'; end if;
  select * into confirmed from public.membership_renewals where member_id = person.id and due_on = p_expected_due_on;
  if found then
    if confirmed.resolution <> p_resolution then raise exception 'A different confirmation already exists.' using errcode = '40001'; end if;
    return jsonb_build_object('status', 'already_confirmed', 'nextDueOn', confirmed.next_due_on, 'lifecycleStatus', person.lifecycle_status);
  end if;
  if person.joined_on is null or person.renewal_due_on is null
     or person.current_membership_path_status <> 'open' or person.lifecycle_status not in ('current', 'former')
     or p_effective_date < person.joined_on then
    raise exception 'Membership is not eligible for renewal confirmation.' using errcode = '22023';
  end if;
  if person.renewal_due_on is distinct from p_expected_due_on then raise exception 'Renewal state changed; refresh before confirming.' using errcode = '40001'; end if;
  next_due := public.membership_anniversary(person.joined_on, extract(year from person.renewal_due_on)::integer + 1);
  next_lifecycle := case
    when next_due > present_date then 'current'
    when person.lifecycle_status = 'former'
      or (person.renewal_due_on + interval '6 months')::date <= present_date then 'former'
    else 'current' end;
  insert into public.membership_renewals(member_id, due_on, confirmed_on, resolution, next_due_on, reference, note, confirmed_by_user_id)
  values (person.id, person.renewal_due_on, p_effective_date, p_resolution, next_due, nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''), actor_id);
  update public.members set renewal_due_on = next_due, lifecycle_status = next_lifecycle, member_type = 'current',
    lifecycle_changed_at = now(), lifecycle_changed_by_user_id = actor_id, lifecycle_note = 'Annual renewal confirmed.' where id = person.id;
  update public.profile_update_requests set status = 'approved', reviewed_at = now(), reviewed_by_user_id = actor_id,
    review_note = 'Administrator confirmed this anniversary.'
    where member_id = person.id and request_type = 'membership_renewal' and status = 'pending' and payload ->> 'dueOn' = person.renewal_due_on::text;
  perform private.record_membership_transition(person.id, 'renewal_confirmed', jsonb_build_object(
    'previousLifecycleStatus', person.lifecycle_status, 'lifecycleStatus', next_lifecycle, 'dueOn', person.renewal_due_on,
    'nextDueOn', next_due, 'resolution', p_resolution, 'effectiveDate', p_effective_date, 'accessEvaluatedOn', present_date));
  return jsonb_build_object('status', 'confirmed', 'nextDueOn', next_due, 'lifecycleStatus', next_lifecycle);
end;
$function$;

create or replace function public.review_membership_request(
  p_request_id uuid, p_expected_updated_at timestamptz, p_decision text, p_note text
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  actor_id uuid := private.require_membership_operator(); person public.members%rowtype;
  request public.profile_update_requests%rowtype; target_member uuid; next_path text; portal_role_id uuid;
begin
  if p_decision is null or p_decision not in ('approved', 'rejected') or nullif(btrim(p_note), '') is null or length(p_note) > 500 then
    raise exception 'A decision and reason of at most 500 characters are required.' using errcode = '22023';
  end if;
  select member_id into target_member from public.profile_update_requests where id = p_request_id;
  if not found then raise exception 'Request not found.' using errcode = 'P0002'; end if;
  -- Same member-first order as request/confirmation avoids cross-flow deadlocks.
  select * into person from public.members where id = target_member for update;
  select * into request from public.profile_update_requests where id = p_request_id and member_id = person.id for update;
  if request.status <> 'pending' then
    if request.status = p_decision and not coalesce((request.payload ->> 'withdrawn')::boolean, false) then
      return jsonb_build_object('status', 'already_reviewed', 'requestId', request.id);
    end if;
    raise exception 'Request was already resolved.' using errcode = '40001';
  end if;
  if request.updated_at is distinct from p_expected_updated_at then raise exception 'Request changed; refresh before reviewing.' using errcode = '40001'; end if;
  next_path := person.current_membership_path_status;
  if request.request_type = 'membership_departure' then
    if person.current_membership_path_status <> 'departure_requested' or person.current_membership_case_id is distinct from request.id
      or person.lifecycle_status <> 'former' then raise exception 'Departure case is no longer pending.' using errcode = '22023'; end if;
    next_path := case when p_decision = 'approved' then 'closed_appealable' else 'open' end;
    update public.members set current_membership_path_status = next_path,
      current_membership_closed_on = case when p_decision = 'approved' then (now() at time zone 'Asia/Dhaka')::date else null end,
      current_membership_closed_by_user_id = case when p_decision = 'approved' then actor_id else null end,
      current_membership_closure_reason = case when p_decision = 'approved' then 'voluntary_departure' else null end where id = person.id;
  elsif request.request_type = 'membership_departure_appeal' then
    if person.current_membership_path_status <> 'closed_appealable' or person.current_membership_appeal_id is distinct from request.id
      or request.payload ->> 'caseId' is distinct from person.current_membership_case_id::text
      or person.lifecycle_status <> 'former' then raise exception 'Appeal does not match the open departure case.' using errcode = '22023'; end if;
    next_path := case when p_decision = 'approved' then 'open' else 'closed_final' end;
    update public.members set current_membership_path_status = next_path,
      current_membership_closure_reason = case when p_decision = 'approved' then null else 'departure_appeal_rejected' end,
      current_membership_closed_on = case when p_decision = 'approved' then null else (now() at time zone 'Asia/Dhaka')::date end,
      current_membership_closed_by_user_id = case when p_decision = 'approved' then null else actor_id end where id = person.id;
  elsif request.request_type = 'alumni_conversion' then
    if person.lifecycle_status <> 'former' then raise exception 'Former membership is required for this alumni transition.' using errcode = '22023'; end if;
    if p_decision = 'approved' then
      -- Replace only the portal scope, in the same transaction as conversion.
      -- Existing role-grant triggers invalidate stale claims and audit the change.
      if person.user_id is not null then
        select id into portal_role_id from public.rbac_platform_roles
          where scope = 'portal' and code = 'alumni' and is_assignable;
        if not found then raise exception 'The alumni portal role is unavailable.' using errcode = '22023'; end if;
        update public.rbac_user_platform_roles set revoked_at = now(),
          note = 'Replaced by approved alumni conversion.'
          where user_id = person.user_id and scope = 'portal' and revoked_at is null;
        insert into public.rbac_user_platform_roles(user_id, role_id, scope, granted_by, note)
          values(person.user_id, portal_role_id, 'portal', actor_id, 'Approved alumni conversion.');
      end if;
      update public.members set lifecycle_status = 'alumni', member_type = 'alumni',
        alumni_since = coalesce(alumni_since, (now() at time zone 'Asia/Dhaka')::date),
        lifecycle_changed_at = now(), lifecycle_changed_by_user_id = actor_id where id = person.id;
      next_path := 'closed_final';
    end if;
  else raise exception 'This request type needs its dedicated review workflow.' using errcode = '22023';
  end if;
  update public.profile_update_requests set status = p_decision, reviewed_at = now(), review_note = btrim(p_note), reviewed_by_user_id = actor_id where id = request.id;
  perform private.record_membership_transition(person.id, 'membership_request_reviewed', jsonb_build_object(
    'requestId', request.id, 'requestType', request.request_type, 'decision', p_decision, 'reason', btrim(p_note),
    'previousPathStatus', person.current_membership_path_status, 'pathStatus', next_path, 'portalAccessStatus', person.portal_access_status));
  return jsonb_build_object('status', p_decision, 'requestId', request.id, 'pathStatus', next_path);
end;
$function$;

-- Lifecycle requests have one guarded writer/reviewer, including alumni.
-- Normal requests must be mutable even before a delayed Cron reconciliation.
drop policy if exists "profile update request own insert" on public.profile_update_requests;
create policy "profile update request own insert" on public.profile_update_requests
for insert to authenticated with check (
  request_type in ('workplace_update', 'profile_change', 'email_change', 'jnuits_id_change', 'account_deletion')
  and status = 'pending' and reviewed_at is null and reviewed_by_user_id is null
  and exists (
    select 1 from public.members m
    where m.id = member_id and m.user_id = (select auth.uid())
      and m.portal_access_status = 'active'
      and (
        m.lifecycle_status = 'alumni'
        or (m.lifecycle_status = 'current' and m.current_membership_path_status = 'open'
          and (m.renewal_due_on is null
            or (m.renewal_due_on + interval '6 months')::date > (now() at time zone 'Asia/Dhaka')::date))
      )
  )
);
drop policy if exists "profile update request membership admin update" on public.profile_update_requests;
create policy "profile update request membership admin update" on public.profile_update_requests
for update to authenticated
using (request_type not in ('membership_renewal', 'membership_departure', 'membership_departure_appeal', 'alumni_conversion')
  and (select public.has_permission('admin.membership.manage')))
with check (request_type not in ('membership_renewal', 'membership_departure', 'membership_departure_appeal', 'alumni_conversion')
  and (select public.has_permission('admin.membership.manage')));

-- CREATE OR REPLACE retains ACLs; pin them explicitly for this release.
revoke all on function private.initialize_member_anniversary() from public, anon, authenticated, service_role;
revoke all on function public.confirm_membership_renewal(uuid, date, text, text, text, date) from public, anon, service_role;
grant execute on function public.confirm_membership_renewal(uuid, date, text, text, text, date) to authenticated;
revoke all on function public.review_membership_request(uuid, timestamptz, text, text) from public, anon, service_role;
grant execute on function public.review_membership_request(uuid, timestamptz, text, text) to authenticated;
-- Existing retained onboarding path: the output parameter jnuits_id must
-- never shadow its canonical lookup column. Signature/behavior/ACLs stay intact.
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
    select * into member from public.members where id = onboarding.processed_member_id;
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
    from public.members as canonical
    where upper(trim(canonical.jnuits_id::text)) = normalized_jnuits_id
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

  if member_by_id.id is not null then
    member := member_by_id;
  else
    member := member_by_email;
  end if;

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
      email, full_name, jnuits_id, lifecycle_changed_at, lifecycle_note,
      lifecycle_status, member_type, portal_access_status, professional_visibility
    ) values (
      normalized_email,
      coalesce(nullif(trim(onboarding.full_name), ''), 'JnUITS alumni'),
      normalized_jnuits_id,
      now_value,
      'Created through approved alumni onboarding.',
      'alumni', 'alumni', 'active', 'members-only'
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

  if member.user_id is null then
    insert into public.member_invitations (
      member_id, code_hash, expires_at, max_uses, notes, created_by_user_id
    ) values (
      member.id, p_invitation_code_hash, p_invitation_expires_at, 1,
      nullif(trim(p_review_note), ''), p_actor_user_id
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
    'alumni.onboarding_approved', p_actor_user_id, onboarding.id,
    'alumni_onboarding_case',
    jsonb_build_object(
      'memberId', member.id,
      'invitationId', invitation.id,
      'jnuitsId', member.jnuits_id
    )
  );

  return query select
    case when invitation.id is null then 'reactivated' else 'approved' end,
    member.id, invitation.id, member.jnuits_id::text, member.email::text;
end;
$function$;

revoke all on function public.approve_alumni_onboarding_case(uuid, uuid, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.approve_alumni_onboarding_case(uuid, uuid, text, timestamptz, text) to service_role;
commit;

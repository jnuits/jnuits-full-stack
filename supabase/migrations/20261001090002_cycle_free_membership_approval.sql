-- Forward-only retirement: historical cycle tables/FKs remain readable.
begin;
set local lock_timeout = '5s';

-- Preserve the public argument name but disambiguate column references. The
-- historical allocator fails with PL/pgSQL variable_conflict=error (the default).
create or replace function public.allocate_membership_id(year_block text)
returns text language plpgsql security definer set search_path = ''
as $function$
declare safe_block text := btrim(coalesce(year_block,'')); next_serial integer;
begin
  if auth.role() is distinct from 'service_role' and not public.has_permission('admin.membership.manage') then
    raise exception 'Insufficient permission to allocate membership IDs.' using errcode='42501';
  end if;
  if safe_block !~ '^[0-9]{4}$' then raise exception 'Membership ID block must be exactly four digits.'; end if;
  insert into public.membership_id_sequences(year_block,last_serial) values(safe_block,0)
    on conflict on constraint membership_id_sequences_pkey do nothing;
  update public.membership_id_sequences as sequence_row set last_serial=sequence_row.last_serial+1
    where sequence_row.year_block=safe_block and sequence_row.last_serial<999
    returning sequence_row.last_serial into next_serial;
  if next_serial is null then raise exception 'Membership ID block % has no remaining serials.',safe_block; end if;
  return 'JNUITS-'||safe_block||lpad(next_serial::text,3,'0');
end;
$function$;

create or replace function public.bind_membership_application_cycle()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
begin
  -- Serialize pending-identity checks without assuming historical rows are unique.
  perform pg_advisory_xact_lock(hashtextextended('membership-application-intake',0));
  if tg_op = 'INSERT' then new.membership_cycle_id := null; end if;
  new.email := lower(btrim(new.email::text));
  new.student_id := nullif(lower(btrim(coalesce(new.student_id,''))),'');
  if new.status in ('pending','needs_review') and exists (
    select 1 from public.membership_applications a
    where a.id is distinct from new.id and a.status in ('pending','needs_review')
      and (lower(btrim(a.email::text)) = new.email::text
        or (new.student_id is not null and lower(btrim(a.student_id)) = new.student_id))
  ) then
    raise exception 'A pending application already exists for this email or student ID.' using errcode = '23505';
  end if;
  return new;
end;
$function$;
drop trigger membership_applications_bind_cycle on public.membership_applications;
create trigger membership_applications_bind_cycle
before insert or update of email,student_id,status on public.membership_applications
for each row execute function public.bind_membership_application_cycle();

-- Keep existing server callers compatible through the default joining date,
-- without an ambiguous five-argument overload.
drop function public.approve_membership_application(uuid,uuid,text,timestamptz,text);
create function public.approve_membership_application(
  p_application_id uuid, p_actor_user_id uuid, p_invitation_code_hash text,
  p_invitation_expires_at timestamptz, p_review_note text, p_joined_on date default null
)
returns table(result_status text,member_id uuid,invitation_id uuid,jnuits_id text)
language plpgsql security invoker set search_path = ''
as $function$
declare
  application public.membership_applications%rowtype;
  person public.members%rowtype;
  invitation public.member_invitations%rowtype;
  matched_ids uuid[];
  normalized_email text; normalized_student_id text;
  next_jnuits_id text;
  now_value timestamptz := clock_timestamp();
  today date := (now_value at time zone 'Asia/Dhaka')::date;
  joined_value date := coalesce(p_joined_on,today);
begin
  if p_application_id is null or p_actor_user_id is null
    or coalesce(btrim(p_invitation_code_hash),'') = ''
    or p_invitation_expires_at is null or p_invitation_expires_at <= now_value
    or length(coalesce(p_review_note,'')) > 1500 then
    return query select 'invalid'::text,null::uuid,null::uuid,null::text; return;
  end if;
  if joined_value > today then
    raise exception 'Joining date cannot be in the future.' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('membership-application-identity',0));
  select * into application from public.membership_applications where id=p_application_id for update;
  if not found then return query select 'not_found'::text,null::uuid,null::uuid,null::text; return; end if;
  if application.status='approved' and application.processed_member_id is not null and application.invitation_id is not null then
    select * into person from public.members where id=application.processed_member_id;
    return query select 'already_approved'::text,person.id,application.invitation_id,person.jnuits_id::text; return;
  end if;
  if application.status not in ('pending','needs_review') then
    return query select 'already_processed'::text,null::uuid,null::uuid,null::text; return;
  end if;
  normalized_email := lower(btrim(application.email::text));
  normalized_student_id := nullif(lower(btrim(coalesce(application.student_id,''))),'');
  select array_agg(m.id) into matched_ids from public.members m
  where (application.processed_member_id is not null and m.id=application.processed_member_id)
    or (m.email is not null and lower(btrim(m.email::text))=normalized_email)
    or (normalized_student_id is not null and lower(btrim(m.student_id))=normalized_student_id);
  if cardinality(matched_ids)>1 then
    return query select 'identity_conflict'::text,null::uuid,null::uuid,null::text; return;
  end if;
  if cardinality(matched_ids)=1 then
    select * into person from public.members where id=matched_ids[1] for update;
    if (person.email is not null and lower(btrim(person.email::text))<>normalized_email)
      or (normalized_student_id is not null and nullif(btrim(person.student_id),'') is not null
        and lower(btrim(person.student_id))<>normalized_student_id) then
      return query select 'identity_conflict'::text,null::uuid,null::uuid,null::text; return;
    end if;
    if person.is_profile_claimed or person.user_id is not null or person.lifecycle_status='alumni'
      or person.current_membership_path_status<>'open' then
      return query select 'already_member'::text,null::uuid,null::uuid,null::text; return;
    end if;
    if p_joined_on is not null and person.joined_on is not null and p_joined_on<>person.joined_on then
      return query select 'joining_date_conflict'::text,null::uuid,null::uuid,null::text; return;
    end if;
    update public.members set email=coalesce(email,normalized_email),phone=coalesce(phone,application.phone),
      student_id=coalesce(student_id,normalized_student_id),
      joined_on=coalesce(joined_on,p_joined_on),updated_at=now_value
    where id=person.id returning * into person;
  else
    next_jnuits_id := public.allocate_membership_id(extract(year from joined_value)::integer::text);
    insert into public.members(jnuits_id,full_name,email,phone,department_code,batch_no,student_id,
      joined_on,lifecycle_status,member_type,portal_access_status,professional_visibility,facebook_url,linkedin_url)
    values(next_jnuits_id,application.name,normalized_email,application.phone,application.department_code,
      -- Historical public forms collected ordinal batch labels. Strict two-digit
      -- manual/import normalization remains the existing shared contract.
      case when coalesce(application.batch_label,'') ~ '^[0-9]{1,2}(st|nd|rd|th)?( Batch)?$'
        and substring(application.batch_label from '^[0-9]+')::integer between 1 and 99
        then substring(application.batch_label from '^[0-9]+')::integer else null end,
      normalized_student_id,joined_value,'current','current','active','members-only',application.facebook_url,application.linkedin_url)
    returning * into person;
  end if;
  insert into public.member_invitations(member_id,code_hash,expires_at,max_uses,notes,created_by_user_id)
    values(person.id,p_invitation_code_hash,p_invitation_expires_at,1,nullif(btrim(p_review_note),''),p_actor_user_id)
    returning * into invitation;
  update public.membership_applications set status='approved',review_note=nullif(btrim(p_review_note),''),
    reviewed_at=now_value,reviewed_by_user_id=p_actor_user_id,processed_member_id=person.id,
    invitation_id=invitation.id,updated_at=now_value where id=application.id;
  insert into public.membership_lifecycle_events(member_id,event_type,summary,metadata,created_by_user_id)
  values(person.id,'application_approved','Membership application approved and claim invitation issued.',
    jsonb_build_object('applicationId',application.id,'joinedOn',person.joined_on,'renewalDueOn',person.renewal_due_on,'invitationId',invitation.id),p_actor_user_id);
  insert into public.audit_events(action,actor_user_id,entity_id,entity_type,metadata)
  values('membership.application_approved',p_actor_user_id,application.id,'membership_application',
    jsonb_build_object('memberId',person.id,'joinedOn',person.joined_on,'renewalDueOn',person.renewal_due_on,
      'invitationId',invitation.id,'jnuitsId',person.jnuits_id));
  return query select 'approved'::text,person.id,invitation.id,person.jnuits_id::text;
end;
$function$;
revoke all on function public.approve_membership_application(uuid,uuid,text,timestamptz,text,date) from public,anon,authenticated;
grant execute on function public.approve_membership_application(uuid,uuid,text,timestamptz,text,date) to service_role;
revoke all on function public.transition_membership_cycle(uuid,text,uuid) from public,anon,authenticated,service_role;
commit;

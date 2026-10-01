-- Disposable replay only; synthetic fixtures and all writes roll back.
begin;
do $approval_contract$
declare
  actor_id uuid; application_id uuid; person_id uuid; other_id uuid;
  today date := (now() at time zone 'Asia/Dhaka')::date;
  result record; person public.members%rowtype;
  cycle_count integer; auth_count integer; invitation_count integer;
begin
  select id into actor_id from auth.users where email = 'replay-harness@local.invalid';
  if current_database() <> 'postgres' or actor_id is null
    or not exists (select 1 from supabase_migrations.schema_migrations where version = '20260608092959') then
    raise exception 'Refusing approval assertions outside the disposable stack.';
  end if;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  select count(*) into cycle_count from public.membership_cycle_memberships;
  select count(*) into auth_count from auth.users;
  -- No active window is needed, and a caller cannot bind new intake to a cycle.
  update public.membership_cycles set status = 'closed' where status = 'active';
  insert into public.membership_applications(name,email,batch_label,student_id,status)
  values ('Fictional Earlier Applicant','  earlier@local.invalid  ','08',' EARLIER-001 ','pending') returning id into application_id;
  if (select membership_cycle_id from public.membership_applications where id = application_id) is not null
    or (select email::text from public.membership_applications where id = application_id) <> 'earlier@local.invalid'
    or (select student_id from public.membership_applications where id = application_id) <> 'earlier-001' then
    raise exception 'Intake is not cycle-free and normalized.';
  end if;
  begin
    insert into public.membership_applications(name,email,status)
    values ('Fictional Duplicate','EARLIER@local.invalid','pending');
    raise exception 'Duplicate pending email accepted.';
  exception when unique_violation then null; end;
  begin
    insert into public.membership_applications(name,email,student_id,status)
    values ('Fictional Duplicate','other@local.invalid','earlier-001','needs_review');
    raise exception 'Duplicate pending student identity accepted.';
  exception when unique_violation then null; end;
  select * into result from public.approve_membership_application(application_id,actor_id,'earlier-hash',now()+interval '14 days','Verified official date.',date '2024-07-01');
  if result.result_status <> 'approved' then raise exception 'Cycle-free approval failed: %',result.result_status; end if;
  person_id := result.member_id;
  select * into person from public.members where id = person_id;
  if person.joined_on <> date '2024-07-01' or person.renewal_due_on <> date '2025-07-01'
    or person.jnuits_id not like 'JNUITS-2024%' or person.batch_no <> 8 then
    raise exception 'Approval did not preserve joining date, first anniversary, year allocation, or batch 08.';
  end if;
  select count(*) into invitation_count from public.member_invitations where member_id=person_id;
  select * into result from public.approve_membership_application(application_id,actor_id,'retry-hash',now()+interval '14 days',null,date '2023-01-01');
  if result.result_status <> 'already_approved'
    or (select count(*) from public.member_invitations where member_id=person_id) <> invitation_count
    or (select joined_on from public.members where id=person_id) <> date '2024-07-01' then
    raise exception 'Retry created a duplicate invitation or rewrote joining history.';
  end if;
  -- Invalid/future dates fail transactionally before member/invitation creation.
  insert into public.membership_applications(name,email,status)
  values ('Fictional Default Applicant','default@local.invalid','pending') returning id into application_id;
  begin
    perform public.approve_membership_application(application_id,actor_id,'future-hash',now()+interval '14 days',null,today+1);
    raise exception 'Future joining date accepted.';
  exception when invalid_parameter_value then null; end;
  if (select status from public.membership_applications where id=application_id) <> 'pending' then
    raise exception 'Failed approval changed the application.';
  end if;
  select * into result from public.approve_membership_application(application_id,actor_id,'default-hash',now()+interval '14 days',null);
  select * into person from public.members where id=result.member_id;
  if result.result_status <> 'approved' or person.joined_on <> today
    or person.renewal_due_on <> public.membership_anniversary(today, extract(year from today)::integer+1)
    or person.jnuits_id not like ('JNUITS-'||extract(year from today)::text||'%') then
    raise exception 'Default approval date is not the Dhaka joining date.';
  end if;
  -- Ambiguous email/student matches must never merge two people.
  insert into public.members(jnuits_id,full_name,email,student_id,joined_on,lifecycle_status,portal_access_status)
  values ('JNUITS-1997001','Fictional Existing Person','existing@local.invalid','existing-001',date '1997-07-01','former','frozen') returning id into person_id;
  insert into public.membership_applications(name,email,student_id,status)
  values ('Fictional Existing Person','existing@local.invalid','existing-001','pending') returning id into application_id;
  select * into result from public.approve_membership_application(application_id,actor_id,'existing-conflict-hash',now()+interval '14 days',null,date '1997-07-02');
  if result.result_status <> 'joining_date_conflict' then raise exception 'Known joining date was silently replaced.'; end if;
  select * into result from public.approve_membership_application(application_id,actor_id,'existing-hash',now()+interval '14 days',null,date '1997-07-01');
  select * into person from public.members where id=person_id;
  if result.result_status <> 'approved' or result.member_id <> person_id
    or person.portal_access_status <> 'frozen' or person.lifecycle_status <> 'former'
    or person.joined_on <> date '1997-07-01' or person.jnuits_id <> 'JNUITS-1997001' then
    raise exception 'Existing canonical member approval rewrote identity, dates, lifecycle or security.';
  end if;
  insert into public.members(jnuits_id,full_name,email,joined_on,is_profile_claimed)
  values ('JNUITS-1997002','Fictional Claimed Person','claimed@local.invalid',date '1997-07-01',true) returning id into person_id;
  insert into public.membership_applications(name,email,status)
  values ('Fictional Claimed Person','claimed@local.invalid','pending') returning id into application_id;
  select * into result from public.approve_membership_application(application_id,actor_id,'claimed-hash',now()+interval '14 days',null);
  if result.result_status <> 'already_member' or exists(select 1 from public.member_invitations where member_id=person_id) then
    raise exception 'Already-claimed profile received a new claim invitation.';
  end if;
  insert into public.members(jnuits_id,full_name,email,joined_on)
  values ('JNUITS-1997003','Fictional Unknown Date','unknown-date@local.invalid',null) returning id into person_id;
  insert into public.membership_applications(name,email,status)
  values ('Fictional Unknown Date','unknown-date@local.invalid','pending') returning id into application_id;
  select * into result from public.approve_membership_application(application_id,actor_id,'unknown-date-hash',now()+interval '14 days',null);
  if result.result_status <> 'approved' or (select joined_on from public.members where id=person_id) is not null then
    raise exception 'Legacy unknown joining date was fabricated from the approval date.';
  end if;
  insert into public.members(jnuits_id,full_name,email,student_id,joined_on)
  values ('JNUITS-1998001','Fictional Email Person','conflict@local.invalid','email-person',date '1998-07-01') returning id into person_id;
  insert into public.members(jnuits_id,full_name,email,student_id,joined_on)
  values ('JNUITS-1998002','Fictional Student Person','student@local.invalid','student-person',date '1998-07-01') returning id into other_id;
  insert into public.membership_applications(name,email,student_id,status)
  values ('Fictional Conflict','conflict@local.invalid','student-person','pending') returning id into application_id;
  select * into result from public.approve_membership_application(application_id,actor_id,'conflict-hash',now()+interval '14 days',null);
  if result.result_status <> 'identity_conflict'
    or (select status from public.membership_applications where id=application_id) <> 'pending'
    or exists(select 1 from public.member_invitations where member_id in(person_id,other_id)) then
    raise exception 'Conflicting canonical identities were approved.';
  end if;
  if (select count(*) from public.membership_cycle_memberships) <> cycle_count
    or (select count(*) from auth.users) <> auth_count then
    raise exception 'Approval wrote a cycle enrollment or provisioned an auth account.';
  end if;
  if not exists(select 1 from public.audit_events where action='membership.application_approved' and actor_user_id=actor_id)
    or has_function_privilege('authenticated','public.approve_membership_application(uuid,uuid,text,timestamptz,text,date)','EXECUTE')
    or has_function_privilege('anon','public.approve_membership_application(uuid,uuid,text,timestamptz,text,date)','EXECUTE')
    or has_function_privilege('service_role','public.transition_membership_cycle(uuid,text,uuid)','EXECUTE') then
    raise exception 'Approval audit or legacy cycle privilege retirement failed.';
  end if;
  raise notice 'Cycle-free approval, joining dates, identity, idempotency and privilege assertions passed.';
end;
$approval_contract$;
rollback;

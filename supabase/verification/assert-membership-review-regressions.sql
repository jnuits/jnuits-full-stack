-- Disposable replay only. Exercise real functions and authenticated RLS.
begin;
-- Reproduce legacy exposed-table grants inside this rollback-only fixture;
-- fresh CLI explicit-grant defaults must not make a bad policy look safe.
grant select, insert, update on public.profile_update_requests to authenticated;
do $review_contract$
declare
  operator_id uuid; member_user uuid := extensions.gen_random_uuid(); person_id uuid;
  role_id uuid; request_id uuid; request_version timestamptz; revision bigint;
  today date := (now() at time zone 'Asia/Dhaka')::date;
  joined date := date_trunc('month', (now() at time zone 'Asia/Dhaka') - interval '2 years 3 months')::date;
  due date := date_trunc('month', (now() at time zone 'Asia/Dhaka') - interval '1 year 3 months')::date;
  next_due date := date_trunc('month', (now() at time zone 'Asia/Dhaka') - interval '3 months')::date;
  result jsonb; failures text[] := '{}'; kind text; old_version bigint;
begin
  select id into operator_id from auth.users where email = 'replay-harness@local.invalid';
  if operator_id is null then raise exception 'Disposable replay identity required.'; end if;
  insert into auth.users(id,email) values(member_user,'review-fixture@local.invalid');
  select id into role_id from public.rbac_platform_roles where code='admin' and scope='admin';
  insert into public.rbac_user_platform_roles(user_id,role_id,scope,note)
    values(operator_id,role_id,'admin','Review regression fixture');
  insert into public.admin_profiles(user_id,admin_code,display_name,is_active,status)
    values(operator_id,'JNUITS-ADMIN-REPLAY-REVIEW','Fictional operator',true,'active')
    on conflict(user_id) do update set is_active=true,status='active';
  insert into public.members(jnuits_id,full_name,user_id,joined_on,lifecycle_status,portal_access_status)
    values('JNUITS-2099971','Fictional review member',member_user,joined,'former','active') returning id into person_id;
  select id into role_id from public.rbac_platform_roles where code='member' and scope='portal';
  insert into public.rbac_user_platform_roles(user_id,role_id,scope,note)
    values(member_user,role_id,'portal','Review regression fixture');
  -- Give the member an independent admin scope to prove conversion preserves it.
  select id into role_id from public.rbac_platform_roles where code='content_admin' and scope='admin';
  insert into public.rbac_user_platform_roles(user_id,role_id,scope,note)
    values(member_user,role_id,'admin','Separate scope fixture');
  perform set_config('request.jwt.claim.sub',operator_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',operator_id,'aal','aal2','role','authenticated')::text,true);
  result := public.confirm_membership_renewal(person_id,due,'paid',null,'Historical receipt',next_due-1);
  if result->>'lifecycleStatus' <> 'former' or (select renewal_due_on from public.members where id=person_id) <> next_due then
    failures := array_append(failures,'backdated confirmation reactivated an outstanding anniversary');
  end if;
  if (select confirmed_on from public.membership_renewals where member_id=person_id and due_on=due) <> next_due-1 then
    raise exception 'Historical receipt date was not retained separately.';
  end if;
  -- Legacy service setter must not bypass the ledger, even inside grace after partial catch-up.
  update public.members set lifecycle_status='former' where id=person_id;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',operator_id,'role','service_role')::text,true);
  begin
    perform public.set_member_lifecycle_status(person_id,'current','active','Legacy shortcut');
    failures := array_append(failures,'legacy lifecycle editor reactivated unpaid former membership');
  exception when sqlstate '22023' then null; end;
  update public.members set lifecycle_status='former' where id=person_id;
  perform public.set_member_lifecycle_status(person_id,'former','frozen','Security restriction only');
  if (select lifecycle_status from public.members where id=person_id) <> 'former'
    or (select portal_access_status from public.members where id=person_id) <> 'frozen' then
    raise exception 'Independent security-status editing was broken.';
  end if;
  update public.members set portal_access_status='active',current_membership_path_status='closed_final' where id=person_id;
  perform set_config('request.jwt.claim.sub',member_user::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',member_user,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  foreach kind in array array['workplace_update','profile_change','email_change','jnuits_id_change','alumni_conversion'] loop
    begin
      insert into public.profile_update_requests(member_id,request_type,payload)
        values(person_id,kind,'{}');
      failures := array_append(failures,'authenticated former inserted '||kind||' directly');
    exception when insufficient_privilege then null; end;
  end loop;
  execute 'reset role';
  -- Simulate a missed Cron with stored-current, already date-expired membership.
  insert into public.members(jnuits_id,full_name,joined_on,user_id)
    values('JNUITS-2099972','Fictional expired member',today-interval '3 years',operator_id);
  perform set_config('request.jwt.claim.sub',operator_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',operator_id,'aal','aal2','role','authenticated')::text,true);
  execute 'set local role authenticated';
  begin
    insert into public.profile_update_requests(member_id,request_type,payload)
      select id,'profile_change','{}' from public.members where jnuits_id='JNUITS-2099972';
    failures := array_append(failures,'stored-current expired member bypassed request RLS');
  exception when insufficient_privilege then null; end;
  execute 'reset role';
  -- Alumni request must use its guarded transaction, even after final departure closure.
  delete from public.profile_update_requests where member_id=person_id;
  perform set_config('request.jwt.claim.sub',member_user::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',member_user,'role','authenticated')::text,true);
  select membership_revision into revision from public.members where id=person_id;
  result := public.request_membership_transition('alumni',revision,null,null);
  request_id := (result->>'requestId')::uuid;
  select updated_at into request_version from public.profile_update_requests where id=request_id;
  select version into old_version from public.rbac_user_claim_versions where user_id=member_user;
  perform set_config('request.jwt.claim.sub',operator_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',operator_id,'aal','aal2','role','authenticated')::text,true);
  -- Direct admin table UPDATE cannot fake the lifecycle decision either.
  execute 'set local role authenticated';
  begin
    update public.profile_update_requests set status='approved' where id=request_id;
  exception when insufficient_privilege then null; end;
  execute 'reset role';
  if (select status from public.profile_update_requests where id=request_id) <> 'pending' then
    failures := array_append(failures,'direct admin table UPDATE bypassed alumni transaction');
    update public.profile_update_requests set status='pending' where id=request_id;
  end if;
  select updated_at into request_version from public.profile_update_requests where id=request_id;
  -- A frozen member's security restriction must survive approval.
  update public.members set portal_access_status='frozen' where id=person_id;
  perform public.review_membership_request(request_id,request_version,'approved','Fictional alumni approval');
  if not exists(select 1 from public.rbac_user_platform_roles g join public.rbac_platform_roles r on r.id=g.role_id
    where g.user_id=member_user and g.scope='portal' and g.revoked_at is null and r.code='alumni')
    or exists(select 1 from public.rbac_user_platform_roles g join public.rbac_platform_roles r on r.id=g.role_id
      where g.user_id=member_user and g.scope='portal' and g.revoked_at is null and r.code<>'alumni') then
    failures := array_append(failures,'approved alumni retained the old portal role');
  end if;
  if not exists(select 1 from public.rbac_user_platform_roles where user_id=member_user and scope='admin' and revoked_at is null)
    or (select portal_access_status from public.members where id=person_id) <> 'frozen' then
    raise exception 'Alumni approval changed independent admin scope or security restriction.';
  end if;
  if (select version from public.rbac_user_claim_versions where user_id=member_user) <= old_version then
    failures := array_append(failures,'alumni approval did not invalidate stale role claims');
  end if;
  perform set_config('request.jwt.claim.sub',member_user::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',member_user,'role','authenticated')::text,true);
  if not public.has_permission('portal.mentorship.participate') then
    failures := array_append(failures,'approved alumni missing mentorship permission');
  end if;
  update public.members set portal_access_status='active' where id=person_id;
  execute 'set local role authenticated';
  insert into public.profile_update_requests(member_id,request_type,payload) values(person_id,'profile_change','{}');
  execute 'reset role';
  if cardinality(failures)>0 then raise exception 'Review regressions: %',array_to_string(failures,'; '); end if;
  raise notice 'MEMBERSHIP REVIEW REGRESSIONS PASSED';
end
$review_contract$;
rollback;

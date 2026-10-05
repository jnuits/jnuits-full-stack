-- Forward-only profile editing policy. Browser roles cannot bypass password/API guards.
begin;

create or replace function public.apply_member_self_profile_update(p_user_id uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare m public.members%rowtype; patch jsonb; changed text[]; next_row public.members%rowtype;
begin
  if p_user_id is null or jsonb_typeof(p_patch) is distinct from 'object' or p_patch = '{}'::jsonb
    or octet_length(p_patch::text) > 12000
    or exists(select 1 from jsonb_each(p_patch) e where e.key <> all(array['phone','facebookUrl','linkedinUrl','websiteUrl','currentOrganization','designation','workLocation','professionalVisibility']) or jsonb_typeof(e.value) <> 'string')
    or (p_patch ? 'professionalVisibility' and p_patch->>'professionalVisibility' <> all(array['public','members-only','private'])) then
    raise exception 'Invalid routine profile fields' using errcode='22023';
  end if;
  select * into m from public.members where user_id=p_user_id for update;
  if not found or m.portal_access_status is distinct from 'active' or not coalesce((
    m.lifecycle_status='alumni' or (m.lifecycle_status='current' and m.current_membership_path_status='open'
      and (m.renewal_due_on is null or (m.renewal_due_on + interval '6 months')::date > (now() at time zone 'Asia/Dhaka')::date))),false) then
    raise exception 'Profile is unavailable for self-service edits' using errcode='42501';
  end if;
  select jsonb_object_agg(map.col, to_jsonb(nullif(btrim(e.value #>> '{}'),''))) into patch
    from jsonb_each(p_patch) e join (values
      ('phone','phone'),('facebookUrl','facebook_url'),('linkedinUrl','linkedin_url'),('websiteUrl','website_url'),
      ('currentOrganization','current_organization'),('designation','designation'),('workLocation','work_location'),('professionalVisibility','professional_visibility')
    ) map(key,col) on map.key=e.key;
  select array_agg(e.key order by e.key) into changed from jsonb_each(patch) e where e.value is distinct from to_jsonb(m)->e.key;
  if changed is null then return jsonb_build_object('id',m.id,'changedFields','[]'::jsonb); end if;
  next_row := jsonb_populate_record(m,patch);
  update public.members set phone=next_row.phone,facebook_url=next_row.facebook_url,linkedin_url=next_row.linkedin_url,
    website_url=next_row.website_url,current_organization=next_row.current_organization,designation=next_row.designation,
    work_location=next_row.work_location,professional_visibility=next_row.professional_visibility,updated_at=clock_timestamp() where id=m.id;
  -- Stamp existing requests under the same member lock. A client-supplied
  -- requested_at cannot bypass this server-owned supersession marker.
  update public.profile_update_requests q set metadata=(case when jsonb_typeof(q.metadata)='object' then q.metadata else '{}'::jsonb end) || jsonb_build_object(
    'supersededDirectFields',(select jsonb_agg(distinct field) from (
      select jsonb_array_elements_text(case when jsonb_typeof(q.metadata->'supersededDirectFields')='array' then q.metadata->'supersededDirectFields' else '[]'::jsonb end) field
      union select unnest(changed)
    ) fields)),updated_at=clock_timestamp()
    where q.member_id=m.id and q.status='pending' and q.request_type in ('profile_change','workplace_update');
  insert into public.membership_lifecycle_events(member_id,event_type,summary,created_by_user_id,metadata,occurred_at)
    values(m.id,'profile_direct_edit','Password-verified routine profile details updated.',p_user_id,jsonb_build_object('changedFields',changed),clock_timestamp());
  insert into public.audit_events(action,actor_user_id,entity_id,entity_type,metadata)
    values('member.profile_direct_edit',p_user_id,m.id,'member',jsonb_build_object('changedFields',changed));
  return jsonb_build_object('id',m.id,'changedFields',changed);
end;
$fn$;
revoke all on function public.apply_member_self_profile_update(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.apply_member_self_profile_update(uuid,jsonb) to service_role;

create or replace function public.review_member_profile_update(p_request_id uuid,p_actor_user_id uuid,p_decision text,p_review_note text default '')
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare r public.profile_update_requests%rowtype; m public.members%rowtype; person_id uuid;
  patch jsonb; changed text[]; next_row public.members%rowtype; prior jsonb; applied jsonb;
begin
  if p_decision is null or p_decision <> all(array['approved','rejected']) or length(coalesce(p_review_note,'')) > 1500 then
    raise exception 'Invalid review decision' using errcode='22023';
  end if;
  if not exists(select 1 from public.rbac_user_platform_roles g join public.rbac_platform_roles role on role.id=g.role_id
    join public.admin_profiles ap on ap.user_id=g.user_id and ap.is_active=true and ap.status='active'
    left join public.rbac_role_permissions permission on permission.role_id=g.role_id and permission.permission_code='admin.membership.manage'
    where g.user_id=p_actor_user_id and g.revoked_at is null and role.scope='admin'
      and (role.code='super_admin' or permission.permission_code is not null)) then
    raise exception 'Membership review permission required' using errcode='42501';
  end if;
  -- Consistent lock order with self-service saves; the request is re-read under lock.
  select member_id into person_id from public.profile_update_requests where id=p_request_id;
  select * into m from public.members where id=person_id for update;
  if not found then raise exception 'Linked member could not be loaded' using errcode='22023'; end if;
  select * into r from public.profile_update_requests where id=p_request_id for update;
  if not found or r.member_id<>m.id or r.status<>'pending' or r.request_type<>all(array['workplace_update','profile_change']) then
    raise exception 'Request is not pending or not a supported profile request' using errcode='22023';
  end if;
  if p_decision='approved' then
    if jsonb_typeof(r.payload) is distinct from 'object' then raise exception 'Invalid stored profile payload' using errcode='22023'; end if;
    if exists(select 1 from jsonb_each(r.payload) e where
      (e.key=any(array['batchNo','graduationYear']) and (jsonb_typeof(e.value)<>'number' or e.value::text !~ '^[0-9]+$'))
      or (e.key=any(array['fullName','departmentCode','studentId','phone','facebookUrl','linkedinUrl','websiteUrl','currentOrganization','designation','workLocation','professionalVisibility'])
        and jsonb_typeof(e.value)<>all(array['string','null']))) then
      raise exception 'Invalid stored profile field types' using errcode='22023';
    end if;
    select jsonb_object_agg(map.col,case when jsonb_typeof(e.value)='string' then to_jsonb(nullif(btrim(e.value #>> '{}'),'')) else e.value end) into patch
      from jsonb_each(r.payload) e join (values
        ('fullName','full_name'),('departmentCode','department_code'),('studentId','student_id'),('batchNo','batch_no'),('graduationYear','graduation_year'),
        ('phone','phone'),('facebookUrl','facebook_url'),('linkedinUrl','linkedin_url'),('websiteUrl','website_url'),
        ('currentOrganization','current_organization'),('designation','designation'),('workLocation','work_location'),('professionalVisibility','professional_visibility')
      ) map(key,col) on map.key=e.key
      where ((r.request_type='workplace_update' and map.col=any(array['facebook_url','linkedin_url','website_url','current_organization','designation','work_location','professional_visibility']))
        or (r.request_type='profile_change' and map.col=any(array['full_name','department_code','student_id','batch_no','graduation_year','phone','facebook_url','linkedin_url','website_url'])
          and not (map.col=any(array['full_name','department_code','student_id']) and (e.value='null'::jsonb or btrim(e.value #>> '{}')=''))))
        -- Legacy forms submitted blank optional strings as unchanged fields.
        and e.value<>'null'::jsonb and (jsonb_typeof(e.value)<>'string' or btrim(e.value #>> '{}')<>'');
    if patch is null then raise exception 'No supported profile fields to review' using errcode='22023'; end if;
    -- Legacy pending routine edits remain reviewable, but must not erase a newer self-service save.
    if exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(r.metadata->'supersededDirectFields')='array'
      then r.metadata->'supersededDirectFields' else '[]'::jsonb end) field where patch ? field.value)
      or exists(select 1 from public.membership_lifecycle_events event where event.member_id=m.id and event.event_type='profile_direct_edit'
      and event.occurred_at>r.requested_at and exists(select 1 from jsonb_array_elements_text(event.metadata->'changedFields') field where patch ? field.value)) then
      raise exception 'A newer direct edit supersedes this request. Reject it or ask the member to resubmit.' using errcode='40001';
    end if;
    if patch ? 'full_name' and (patch->>'full_name' is null or length(patch->>'full_name') not between 2 and 160) then raise exception 'Invalid full name' using errcode='22023'; end if;
    if patch ? 'department_code' and not exists(select 1 from public.departments where code=patch->>'department_code' and is_active=true) then raise exception 'Invalid active department' using errcode='22023'; end if;
    if patch ? 'student_id' and (patch->>'student_id' is null or length(patch->>'student_id') not between 1 and 80) then raise exception 'Invalid student ID' using errcode='22023'; end if;
    next_row := jsonb_populate_record(m,patch);
    if (patch ? 'batch_no' and (next_row.batch_no is null or next_row.batch_no not between 1 and 999))
      or (patch ? 'graduation_year' and (next_row.graduation_year is null or next_row.graduation_year not between 1950 and 2100))
      or next_row.professional_visibility <> all(array['public','members-only','private']) then raise exception 'Invalid academic or visibility fields' using errcode='22023'; end if;
    select array_agg(e.key order by e.key),jsonb_object_agg(e.key,to_jsonb(m)->e.key) into changed,prior from jsonb_each(patch) e;
    applied := patch;
    update public.members set full_name=next_row.full_name,department_code=next_row.department_code,student_id=next_row.student_id,
      batch_no=next_row.batch_no,graduation_year=next_row.graduation_year,phone=next_row.phone,facebook_url=next_row.facebook_url,
      linkedin_url=next_row.linkedin_url,website_url=next_row.website_url,current_organization=next_row.current_organization,
      designation=next_row.designation,work_location=next_row.work_location,professional_visibility=next_row.professional_visibility,
      updated_at=clock_timestamp() where id=m.id;
  end if;
  update public.profile_update_requests set status=p_decision,reviewed_at=clock_timestamp(),reviewed_by_user_id=p_actor_user_id,
    review_note=nullif(p_review_note,''),decision_reason=nullif(p_review_note,''),previous_payload_snapshot=coalesce(prior,'{}'),
    applied_payload_snapshot=coalesce(applied,'{}'),updated_at=clock_timestamp() where id=r.id;
  insert into public.membership_lifecycle_events(member_id,event_type,summary,created_by_user_id,metadata)
    values(m.id,case when r.request_type='workplace_update' then 'workplace_update_' else 'profile_change_' end || p_decision,
      'Profile change request ' || p_decision || '.',p_actor_user_id,jsonb_build_object('requestId',r.id,'changedFields',coalesce(changed,array[]::text[])));
  insert into public.audit_events(action,actor_user_id,entity_id,entity_type,metadata)
    values('member.' || r.request_type || '_request_' || p_decision,p_actor_user_id,r.id,'profile_update_request',jsonb_build_object('memberId',m.id,'changedFields',coalesce(changed,array[]::text[])));
  return jsonb_build_object('memberId',m.id,'memberName',m.full_name,'changedFields',coalesce(changed,array[]::text[]));
end;
$fn$;
revoke all on function public.review_member_profile_update(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_member_profile_update(uuid,uuid,text,text) to service_role;

create or replace function public.cancel_member_workplace_update(p_request_id uuid,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare r public.profile_update_requests%rowtype; m public.members%rowtype; person_id uuid;
begin
  select member_id into person_id from public.profile_update_requests where id=p_request_id;
  select * into m from public.members where id=person_id for update;
  if not found or m.user_id is distinct from p_user_id or p_user_id is null or m.portal_access_status is distinct from 'active'
    or not coalesce((m.lifecycle_status='alumni' or (m.lifecycle_status='current' and m.current_membership_path_status='open'
      and (m.renewal_due_on is null or (m.renewal_due_on + interval '6 months')::date > (now() at time zone 'Asia/Dhaka')::date))),false) then
    raise exception 'Mutable owned profile required' using errcode='42501';
  end if;
  select * into r from public.profile_update_requests where id=p_request_id for update;
  if not found or r.member_id<>m.id or r.request_type<>'workplace_update' or r.status<>'pending' then
    raise exception 'Only pending workplace requests can be cancelled' using errcode='22023';
  end if;
  update public.profile_update_requests set status='cancelled',reviewed_at=clock_timestamp(),updated_at=clock_timestamp(),
    decision_reason='Cancelled by requester',review_note='Cancelled by requester',
    metadata=(case when jsonb_typeof(metadata)='object' then metadata else '{}'::jsonb end) || jsonb_build_object('cancelledAt',clock_timestamp(),'cancelledByUserId',p_user_id) where id=r.id;
  insert into public.audit_events(action,actor_user_id,entity_id,entity_type,metadata)
    values('member.workplace_update_request_cancelled',p_user_id,r.id,'profile_update_request',jsonb_build_object('memberId',m.id));
  return jsonb_build_object('memberId',m.id);
end;
$fn$;
revoke all on function public.cancel_member_workplace_update(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cancel_member_workplace_update(uuid,uuid) to service_role;
commit;

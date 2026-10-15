-- Explicit owned declaration; no backfill, no changes to historical migration bytes.
begin;
alter table public.members add column workplace_applicability text
  constraint members_workplace_applicability_value check (workplace_applicability in ('applicable','not_applicable'));
alter table public.members add constraint members_workplace_applicability_consistent check (
  workplace_applicability is distinct from 'not_applicable' or (
    nullif(btrim(current_organization),'') is null and nullif(btrim(designation),'') is null and nullif(btrim(work_location),'') is null
  )
);

-- Every existing service/admin/import/legacy review writer preserves consistency.
-- Browser grants are unchanged; this trigger grants no mutation capability.
create function private.maintain_member_workplace_applicability()
returns trigger language plpgsql set search_path='' as $fn$
declare populated boolean; details_changed boolean;
begin
  populated := nullif(btrim(new.current_organization),'') is not null
    or nullif(btrim(new.designation),'') is not null or nullif(btrim(new.work_location),'') is not null;
  if TG_OP='INSERT' then
    details_changed := true;
  else
    details_changed := (new.current_organization,new.designation,new.work_location)
      is distinct from (old.current_organization,old.designation,old.work_location);
  end if;
  if new.workplace_applicability='not_applicable' and populated then
    if TG_OP='UPDATE' and old.workplace_applicability='not_applicable'
      and new.workplace_applicability is not distinct from old.workplace_applicability and details_changed then
      new.workplace_applicability := 'applicable';
    else
      raise exception 'Clear workplace details before declaring them not applicable' using errcode='22023';
    end if;
  elsif populated and details_changed then
    new.workplace_applicability := 'applicable';
  end if;
  return new;
end $fn$;
revoke all on function private.maintain_member_workplace_applicability() from public,anon,authenticated;
create trigger maintain_member_workplace_applicability
  before insert or update of current_organization,designation,work_location,workplace_applicability on public.members
  for each row execute function private.maintain_member_workplace_applicability();

create or replace function public.apply_member_self_profile_update(p_user_id uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare m public.members%rowtype; patch jsonb; changed text[]; next_row public.members%rowtype;
begin
  if p_user_id is null or jsonb_typeof(p_patch) is distinct from 'object' or p_patch = '{}'::jsonb
    or octet_length(p_patch::text) > 12000
    or exists(select 1 from jsonb_each(p_patch) e where e.key <> all(array['phone','facebookUrl','linkedinUrl','websiteUrl','currentOrganization','designation','workLocation','professionalVisibility','workplaceApplicability']) or jsonb_typeof(e.value) <> 'string')
    or (p_patch ? 'workplaceApplicability' and p_patch->>'workplaceApplicability' <> all(array['applicable','not_applicable','']))
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
      ('currentOrganization','current_organization'),('designation','designation'),('workLocation','work_location'),('professionalVisibility','professional_visibility'),('workplaceApplicability','workplace_applicability')
    ) map(key,col) on map.key=e.key;
  next_row := jsonb_populate_record(m,patch);
  if p_patch->>'workplaceApplicability'='not_applicable'
    and (nullif(btrim(next_row.current_organization),'') is not null
      or nullif(btrim(next_row.designation),'') is not null or nullif(btrim(next_row.work_location),'') is not null) then
    raise exception 'Clear workplace details before declaring them not applicable' using errcode='22023';
  end if;
  if p_patch ?| array['currentOrganization','designation','workLocation']
    and (nullif(btrim(next_row.current_organization),'') is not null
      or nullif(btrim(next_row.designation),'') is not null or nullif(btrim(next_row.work_location),'') is not null) then
    patch := patch || jsonb_build_object('workplace_applicability','applicable');
  end if;
  select array_agg(e.key order by e.key) into changed from jsonb_each(patch) e where e.value is distinct from to_jsonb(m)->e.key;
  if changed is null then return jsonb_build_object('id',m.id,'changedFields','[]'::jsonb); end if;
  next_row := jsonb_populate_record(m,patch);
  update public.members set phone=next_row.phone,facebook_url=next_row.facebook_url,linkedin_url=next_row.linkedin_url,
    website_url=next_row.website_url,current_organization=next_row.current_organization,designation=next_row.designation,
    work_location=next_row.work_location,professional_visibility=next_row.professional_visibility,workplace_applicability=next_row.workplace_applicability,updated_at=clock_timestamp() where id=m.id;
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

commit;

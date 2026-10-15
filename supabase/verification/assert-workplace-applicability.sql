-- Disposable fixtures only. Test both the owned RPC and legacy service writers.
begin;
do $test$
declare uid uuid := extensions.gen_random_uuid(); mid uuid; old_row jsonb;
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='workplace_applicability') then
    raise exception 'Workplace applicability is not implemented';
  end if;
  insert into auth.users(id,email) values(uid,'workplace-applicability@local.invalid');
  insert into public.members(user_id,jnuits_id,full_name,member_type,lifecycle_status,portal_access_status)
    values(uid,'JnUITS-2099958','Synthetic Workplace Test','alumni','alumni','active') returning id into mid;
  perform public.apply_member_self_profile_update(uid,'{"workplaceApplicability":"not_applicable"}');
  if (select workplace_applicability from public.members where id=mid) is distinct from 'not_applicable' then raise exception 'Declaration not persisted'; end if;
  select to_jsonb(m) into old_row from public.members m where id=mid;
  begin
    perform public.apply_member_self_profile_update(uid,'{"workplaceApplicability":"not_applicable","currentOrganization":"Contradiction","phone":"mutated"}');
    raise exception 'Contradiction accepted';
  exception when invalid_parameter_value then null; end;
  if (select to_jsonb(m) from public.members m where id=mid) is distinct from old_row then raise exception 'Partial invalid update persisted'; end if;
  perform public.apply_member_self_profile_update(uid,'{"currentOrganization":"Synthetic Org","designation":"Engineer","workLocation":"Dhaka"}');
  if (select workplace_applicability from public.members where id=mid) is distinct from 'applicable' then raise exception 'New details failed to restore applicability'; end if;
  perform public.apply_member_self_profile_update(uid,'{"workplaceApplicability":"not_applicable","currentOrganization":"","designation":"","workLocation":""}');
  update public.members set current_organization='Legacy service writer' where id=mid;
  if (select workplace_applicability from public.members where id=mid) is distinct from 'applicable' then raise exception 'Legacy writer left contradictory declaration'; end if;
  begin
    update public.members set workplace_applicability='not_applicable' where id=mid;
    raise exception 'Contradictory direct declaration accepted';
  exception when invalid_parameter_value then null; end;
  perform public.apply_member_self_profile_update(uid,'{"currentOrganization":"","workplaceApplicability":""}');
  if (select workplace_applicability from public.members where id=mid) is not null then raise exception 'Unanswered was not restored'; end if;
  if has_function_privilege('anon','public.apply_member_self_profile_update(uuid,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.apply_member_self_profile_update(uuid,jsonb)','EXECUTE') then raise exception 'Browser can bypass password boundary'; end if;
end $test$;
rollback;

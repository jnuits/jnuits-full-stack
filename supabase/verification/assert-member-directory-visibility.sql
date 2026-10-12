-- Disposable clean replay only. Never use this fixture in production.
begin;
do $verify$
declare test_id uuid; visibility_value text;
begin
  insert into public.members (jnuits_id, full_name) values ('JNUITS-2099971','Fictional visibility fixture') returning id,professional_visibility into test_id,visibility_value;
  if visibility_value <> 'public' then raise exception 'New member default is not public'; end if;
  update public.members set professional_visibility='private' where id=test_id;
  update public.members set phone='+8801700000000' where id=test_id;
  select professional_visibility into visibility_value from public.members where id=test_id;
  if visibility_value <> 'private' then raise exception 'Profile edits reset the privacy choice'; end if;
  insert into public.members (jnuits_id,full_name,professional_visibility) values ('JNUITS-2099972','Fictional restricted fixture','members-only') returning professional_visibility into visibility_value;
  if visibility_value <> 'members-only' then raise exception 'Explicit creation privacy was ignored'; end if;
end $verify$;
rollback;

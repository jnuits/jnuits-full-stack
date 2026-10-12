-- Disposable clean-replay database only; all fixture writes roll back.
begin;
do $test$
begin
  if not exists (select 1 from pg_catalog.pg_constraint where conrelid='public.committee_assignments'::regclass and conname='committee_assignments_speech_length' and convalidated) then
    raise exception 'Validated committee speech boundary missing';
  end if;
  if not (select relrowsecurity from pg_catalog.pg_class where oid='public.committee_assignments'::regclass) then
    raise exception 'Committee assignment RLS disabled';
  end if;
end;
$test$;
-- LIKE copies the actual column types/defaults/check constraints, excluding
-- foreign keys and triggers, so no real identities or appointments are touched.
create temporary table _committee_speech_fixture (like public.committee_assignments including defaults including constraints);
insert into _committee_speech_fixture(term_id, role_id, display_name, is_public, status, speech)
values(gen_random_uuid(),gen_random_uuid(),'Synthetic quote fixture',false,'planned',null),
      (gen_random_uuid(),gen_random_uuid(),'Synthetic quote fixture',false,'planned',repeat('x',160)),
      (gen_random_uuid(),gen_random_uuid(),'Synthetic quote fixture',false,'planned',repeat('অ',160));
do $test$
declare rejected_constraint text;
begin
  begin
    insert into _committee_speech_fixture(term_id,role_id,display_name,is_public,status,speech)
      values(gen_random_uuid(),gen_random_uuid(),'Synthetic quote fixture',false,'planned',repeat('x',161));
    raise exception 'Oversized quote accepted';
  exception when check_violation then
    get stacked diagnostics rejected_constraint = constraint_name;
    if rejected_constraint <> 'committee_assignments_speech_length' then raise; end if;
  end;
end;
$test$;
rollback;
select 'COMMITTEE SPEECH ASSERTIONS COMPLETE';

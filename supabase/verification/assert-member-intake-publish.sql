-- Verification-only: must only run on the disposable bootstrap replay stack.
do $intake_publish_contract$
declare
  actor_id uuid;
  admin_role_id uuid;
  member_record public.members%rowtype;
  operation_id uuid;
  scenario record;
  canonical jsonb;
  result jsonb;
  before_member jsonb;
begin
  select id into actor_id from auth.users where email = 'replay-harness@local.invalid';
  if current_database() <> 'postgres' or actor_id is null then
    raise exception 'Refusing intake assertions outside the disposable replay stack.';
  end if;
  select id into admin_role_id from public.rbac_platform_roles where code = 'admin' and scope = 'admin';
  insert into public.rbac_user_platform_roles (user_id, role_id, scope, note)
  values (actor_id, admin_role_id, 'admin', 'member intake contract replay fixture');
  perform set_config('request.jwt.claim.sub', actor_id::text, true);

  for scenario in select * from (values
    ('create', '08', '2024-07-01', 'computer-science-engineering', null::text),
    ('update', '07', '2020-02-29', 'CSE', null::text),
    ('update', null, '2019-07-01', null, null::text),
    ('update', null, null, null, null::text),
    ('update', '00', '2019-07-01', null, '22023'),
    ('update', '100', '2019-07-01', null, '22023'),
    ('update', '08th', '2019-07-01', null, '22023'),
    ('update', '08', '2023-02-29', null, '22023'),
    ('update', '08', '0000-01-01', null, '22023'),
    ('update', '08', '2019-07-01', 'unknown-department', '23503'),
    ('create', '08', null, 'computer-science-engineering', '22023')
  ) as cases(kind, batch, joined, department, expected_error)
  loop
    select * into member_record from public.members where jnuits_id = 'JNUITS-2099088';
    before_member := to_jsonb(member_record);
    operation_id := gen_random_uuid();
    canonical := jsonb_strip_nulls(jsonb_build_object(
      'fullName', 'Sample Intake Replay Member',
      'jnuitsId', case when scenario.kind = 'create' and member_record.id is not null then 'JNUITS-2099089' else 'JNUITS-2099088' end,
      'email', case when scenario.kind = 'create' and member_record.id is not null then 'second-intake@local.invalid' else 'intake-replay@local.invalid' end,
      'classification', 'current', 'departmentCode', scenario.department,
      'batchNo', scenario.batch, 'joinedOn', scenario.joined
    ));
    insert into public.bulk_operations (
      id, operation_type, status, source_kind, draft_revision, total_rows, valid_rows, error_rows, created_by_user_id, metadata
    ) values (operation_id, 'member_profile_import', 'draft', 'manual', 1, 1, 1, 0, actor_id, jsonb_build_object('schemaVersion', 1));
    insert into public.bulk_operation_rows (operation_id, row_number, raw_data, normalized_data, status, errors)
    values (operation_id, 2, '{}'::jsonb, jsonb_build_object(
      'schemaVersion', 1, 'operationType', 'member_profile_import', 'normalized', canonical,
      'identity', jsonb_build_object('kind', scenario.kind, 'memberId', case when scenario.kind = 'update' then member_record.id else null end),
      'targetVersions', jsonb_build_object('memberUpdatedAt', case when scenario.kind = 'update' then member_record.updated_at else null end)
    ), 'valid', '[]'::jsonb);
    perform public.validate_onboarding_draft(operation_id, 1);
    begin
      result := public.commit_onboarding_draft(operation_id, 1, false);
      if scenario.expected_error is not null then raise exception 'Invalid intake unexpectedly published: %.', scenario; end if;
      select * into member_record from public.members where jnuits_id = 'JNUITS-2099088';
      if result ->> 'status' <> 'committed'
         or member_record.department_code <> 'computer-science-engineering'
         or member_record.batch_no <> coalesce(scenario.batch::integer, (before_member ->> 'batch_no')::integer)
         or member_record.joined_on <> coalesce(scenario.joined::date, (before_member ->> 'joined_on')::date) then
        raise exception 'Published member intake did not preserve canonical fields: %.', scenario;
      end if;
      result := public.commit_onboarding_draft(operation_id, 1, false);
      if result ->> 'status' <> 'already_committed' then raise exception 'Intake retry was not idempotent.'; end if;
    exception when sqlstate '22023' or sqlstate '23503' then
      if scenario.expected_error is distinct from sqlstate then raise; end if;
      if (select to_jsonb(m) from public.members m where jnuits_id = 'JNUITS-2099088') is distinct from before_member
         or exists (select 1 from public.members where jnuits_id = 'JNUITS-2099089') then
        raise exception 'Rejected intake changed member data.';
      end if;
    end;
    delete from public.audit_events where entity_id = operation_id::text;
    delete from public.bulk_operations where id = operation_id;
  end loop;
  delete from public.members where jnuits_id = 'JNUITS-2099088';
  delete from public.rbac_user_platform_roles where user_id = actor_id and note = 'member intake contract replay fixture';
  raise notice 'ENFORCED 9 member intake create/update/leading-zero/date/rejection/retry contracts passed.';
end
$intake_publish_contract$;

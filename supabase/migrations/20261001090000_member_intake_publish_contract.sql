begin;

set local lock_timeout = '5s';

-- Forward-only correction of the existing authoritative publish contract.
-- Preserve revision checks, permissions, locks, audit, and retry semantics.
create or replace function public.commit_onboarding_draft(
  p_operation_id uuid,
  p_expected_revision integer,
  p_make_current boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  operation public.bulk_operations%rowtype;
  row_record public.bulk_operation_rows%rowtype;
  member_record public.members%rowtype;
  assignment_record public.committee_assignments%rowtype;
  position_record public.committee_term_positions%rowtype;
  term_record public.committee_terms%rowtype;
  media_record public.media_assets%rowtype;
  canonical jsonb;
  identity_data jsonb;
  assignment_data jsonb;
  assignment_patch jsonb;
  target_versions jsonb;
  jnuits_id_value text;
  email_value text;
  full_name_value text;
  classification_value text;
  member_id_value uuid;
  expected_member_id uuid;
  id_match uuid;
  email_match uuid;
  role_id_value uuid;
  term_id_value uuid;
  assignment_id_value uuid;
  expected_assignment_id uuid;
  requested_department text;
  department_value text;
  batch_value integer;
  joined_value date;
  starts_value date;
  ends_value date;
  sort_value integer;
  public_value boolean;
  assignment_status_value text;
  member_action text;
  assignment_action text;
  processed_members jsonb := '{}'::jsonb;
  result_payload jsonb;
  now_value timestamptz := clock_timestamp();
  active_rows integer := 0;
  created_members integer := 0;
  updated_members integer := 0;
  created_assignments integer := 0;
  updated_assignments integer := 0;
  noop_rows integer := 0;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into operation
  from public.bulk_operations
  where id = p_operation_id
  for update;

  if not found then
    raise exception 'Onboarding draft not found.' using errcode = 'P0002';
  end if;
  if operation.operation_type not in ('committee_roster_import', 'member_profile_import')
     or not public.can_manage_bulk_operation_type(operation.operation_type) then
    raise exception 'Insufficient permission for this onboarding draft.' using errcode = '42501';
  end if;

  if operation.status = 'committed' then
    return jsonb_build_object(
      'status', 'already_committed',
      'operationId', operation.id,
      'result', coalesce(operation.metadata -> 'commitResult', '{}'::jsonb)
    );
  end if;
  if operation.status in ('committing', 'cancelled') then
    raise exception 'This onboarding draft cannot be committed.' using errcode = '55000';
  end if;
  if operation.draft_revision <> p_expected_revision then
    raise exception 'The onboarding draft changed. Reload before committing.' using errcode = '40001';
  end if;
  if operation.validated_revision is null
     or operation.validated_revision <> operation.draft_revision then
    raise exception 'The onboarding draft must be revalidated before committing.' using errcode = '40001';
  end if;

  perform draft_row.id
  from public.bulk_operation_rows as draft_row
  where draft_row.operation_id = operation.id
  order by draft_row.row_number, draft_row.id
  for update;

  select count(*)::integer into active_rows
  from public.bulk_operation_rows
  where operation_id = operation.id and not is_excluded;

  if active_rows = 0 or active_rows > 1000 then
    raise exception 'The onboarding draft must contain between 1 and 1000 active rows.'
      using errcode = '22023';
  end if;

  if operation.operation_type = 'committee_roster_import' then
    select * into term_record
    from public.committee_terms
    where id = operation.target_term_id
    for update;

    if not found then
      raise exception 'The target committee term no longer exists.' using errcode = '40001';
    end if;
    if operation.metadata ->> 'targetTermUpdatedAt' is null
       or term_record.updated_at is distinct from
         (operation.metadata ->> 'targetTermUpdatedAt')::timestamptz then
      raise exception 'The target committee term changed after validation.' using errcode = '40001';
    end if;
  elsif p_make_current then
    raise exception 'Member profile imports cannot change the current committee.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.bulk_operation_rows
    where operation_id = operation.id and not is_excluded
    group by lower(normalized_data #>> '{normalized,jnuitsId}')
    having count(distinct lower(normalized_data #>> '{normalized,email}')) > 1
  ) or exists (
    select 1
    from public.bulk_operation_rows
    where operation_id = operation.id and not is_excluded
    group by lower(normalized_data #>> '{normalized,email}')
    having count(distinct lower(normalized_data #>> '{normalized,jnuitsId}')) > 1
  ) or exists (
    select 1
    from public.bulk_operation_rows
    where operation_id = operation.id and not is_excluded
    group by
      lower(normalized_data #>> '{normalized,jnuitsId}'),
      lower(normalized_data #>> '{normalized,email}')
    having count(distinct (
      (normalized_data -> 'normalized')
      - array['assignment', 'positionRoleId', 'targetTermId']
    )::text) > 1
  ) then
    raise exception 'Draft rows contain conflicting profile values.' using errcode = '23505';
  end if;

  if operation.operation_type = 'committee_roster_import' and exists (
    select 1
    from public.bulk_operation_rows
    where operation_id = operation.id and not is_excluded
    group by
      normalized_data #>> '{assignment,termId}',
      normalized_data #>> '{assignment,roleId}',
      lower(normalized_data #>> '{normalized,jnuitsId}')
    having count(*) > 1
  ) then
    raise exception 'Draft contains a duplicate committee appointment.' using errcode = '23505';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(identity_lock.identity_key, 0)
  )
  from (
    select distinct 'id:' || lower(normalized_data #>> '{normalized,jnuitsId}') as identity_key
    from public.bulk_operation_rows
    where operation_id = operation.id and not is_excluded
    union
    select distinct 'email:' || lower(normalized_data #>> '{normalized,email}') as identity_key
    from public.bulk_operation_rows
    where operation_id = operation.id and not is_excluded
  ) as identity_lock
  order by identity_lock.identity_key;

  perform target_member.id
  from public.members as target_member
  where exists (
    select 1
    from public.bulk_operation_rows as target_row
    where target_row.operation_id = operation.id
      and not target_row.is_excluded
      and target_row.normalized_data #>> '{identity,kind}' = 'update'
      and (target_row.normalized_data #>> '{identity,memberId}')::uuid = target_member.id
  )
  order by target_member.id
  for update of target_member;

  if operation.operation_type = 'committee_roster_import' then
    perform position.id
    from public.committee_term_positions as position
    where exists (
      select 1
      from public.bulk_operation_rows as target_row
      where target_row.operation_id = operation.id
        and not target_row.is_excluded
        and (target_row.normalized_data #>> '{assignment,termId}')::uuid = position.term_id
        and (target_row.normalized_data #>> '{assignment,roleId}')::uuid = position.role_id
    )
    order by position.term_id, position.role_id
    for update of position;

    perform target_assignment.id
    from public.committee_assignments as target_assignment
    where exists (
      select 1
      from public.bulk_operation_rows as target_row
      where target_row.operation_id = operation.id
        and not target_row.is_excluded
        and target_row.normalized_data #>> '{assignment,assignmentId}' is not null
        and (target_row.normalized_data #>> '{assignment,assignmentId}')::uuid = target_assignment.id
    )
    order by target_assignment.id
    for update of target_assignment;
  end if;

  update public.bulk_operations
  set status = 'committing'
  where id = operation.id;

  for row_record in
    select *
    from public.bulk_operation_rows
    where operation_id = operation.id and not is_excluded
    order by row_number, id
  loop
    if row_record.status <> 'valid'
       or jsonb_typeof(row_record.errors) <> 'array'
       or jsonb_array_length(row_record.errors) > 0 then
      raise exception 'Draft row % is not valid.', row_record.row_number using errcode = '22023';
    end if;

    canonical := row_record.normalized_data -> 'normalized';
    identity_data := row_record.normalized_data -> 'identity';
    target_versions := row_record.normalized_data -> 'targetVersions';
    if row_record.normalized_data ->> 'schemaVersion' <> '1'
       or row_record.normalized_data ->> 'operationType' <> operation.operation_type
       or jsonb_typeof(canonical) <> 'object'
       or jsonb_typeof(identity_data) <> 'object'
       or jsonb_typeof(target_versions) <> 'object' then
      raise exception 'Draft row % uses an invalid normalization contract.', row_record.row_number
        using errcode = '22023';
    end if;

    full_name_value := btrim(coalesce(canonical ->> 'fullName', ''));
    jnuits_id_value := public.normalize_jnuits_id(canonical ->> 'jnuitsId');
    email_value := lower(btrim(coalesce(canonical ->> 'email', '')));
    classification_value := lower(btrim(coalesce(canonical ->> 'classification', '')));
    if full_name_value = ''
       or jnuits_id_value !~ '^JNUITS-[0-9]{7}$'
       or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
       or classification_value not in ('current', 'former', 'alumni') then
      raise exception 'Draft row % has invalid required identity fields.', row_record.row_number
        using errcode = '22023';
    end if;

    requested_department := nullif(btrim(canonical ->> 'departmentCode'), '');
    department_value := null;
    if requested_department is not null then
      select department.code into department_value
      from public.departments as department
      where department.is_active and (
        department.code = requested_department
        or exists (
          select 1 from public.department_aliases as alias
          where alias.department_code = department.code
            and alias.is_active
            and alias.normalized_alias = lower(regexp_replace(btrim(requested_department), '[[:space:]]+', ' ', 'g'))
        )
      );
      if not found then
        raise exception 'Draft row % references an unknown department.', row_record.row_number
          using errcode = '23503';
      end if;
    end if;
    batch_value := null;
    if canonical ? 'batchNo' then
      -- Preserve old one-digit staged values while accepting canonical 07/08.
      if coalesce(canonical ->> 'batchNo', '') !~ '^[0-9]{1,2}$' then
        raise exception 'Draft row % has an invalid batch number.', row_record.row_number
          using errcode = '22023';
      end if;
      batch_value := (canonical ->> 'batchNo')::integer;
      if batch_value not between 1 and 99 then
        raise exception 'Draft row % has an invalid batch number.', row_record.row_number
          using errcode = '22023';
      end if;
    end if;

    joined_value := null;
    if canonical ? 'joinedOn' then
      if coalesce(canonical ->> 'joinedOn', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception 'Draft row % has an invalid joining date. Use YYYY-MM-DD.', row_record.row_number
          using errcode = '22023';
      end if;
      begin
        joined_value := (canonical ->> 'joinedOn')::date;
      exception when invalid_datetime_format or datetime_field_overflow then
        raise exception 'Draft row % has an invalid joining date. Use a real calendar date.', row_record.row_number
          using errcode = '22023';
      end;
    end if;
    if operation.operation_type = 'member_profile_import'
       and identity_data ->> 'kind' = 'create'
       and (department_value is null or batch_value is null or joined_value is null) then
      raise exception 'New member profiles require department, batch, and joining date. Row %.', row_record.row_number
        using errcode = '22023';
    end if;
    if (canonical ? 'facebookUrl' and canonical ->> 'facebookUrl' !~* '^https?://')
       or (canonical ? 'linkedinUrl' and canonical ->> 'linkedinUrl' !~* '^https?://')
       or (canonical ? 'websiteUrl' and canonical ->> 'websiteUrl' !~* '^https?://') then
      raise exception 'Draft row % has an invalid profile URL.', row_record.row_number
        using errcode = '22023';
    end if;

    media_record := null;
    if canonical ? 'avatarMediaId' then
      select * into media_record
      from public.media_assets
      where id = (canonical ->> 'avatarMediaId')::uuid
        and is_public
        and deleted_at is null
        and media_kind = 'image'
      for update;
      if not found then
        raise exception 'Draft row % references an unavailable image.', row_record.row_number
          using errcode = '23503';
      end if;
    end if;

    member_action := 'noop';
    if processed_members ? lower(jnuits_id_value) then
      member_id_value := (processed_members ->> lower(jnuits_id_value))::uuid;
    else
      id_match := null;
      email_match := null;
      select id into id_match from public.members where jnuits_id = jnuits_id_value;
      select id into email_match from public.members where email = email_value;

      if identity_data ->> 'kind' = 'create' then
        if id_match is not null or email_match is not null then
          raise exception 'Draft row % identity changed after validation.', row_record.row_number
            using errcode = '40001';
        end if;

        insert into public.members (
          jnuits_id,
          full_name,
          email,
          department_code,
          batch_no,
          joined_on,
          phone,
          student_id,
          facebook_url,
          linkedin_url,
          website_url,
          member_type,
          lifecycle_status,
          avatar_public_id,
          avatar_secure_url,
          avatar_format,
          avatar_bytes,
          avatar_width,
          avatar_height,
          avatar_updated_at,
          avatar_updated_by_user_id
        ) values (
          jnuits_id_value,
          full_name_value,
          email_value,
          department_value,
          batch_value,
          joined_value,
          nullif(btrim(canonical ->> 'phone'), ''),
          nullif(btrim(canonical ->> 'studentId'), ''),
          nullif(btrim(canonical ->> 'facebookUrl'), ''),
          nullif(btrim(canonical ->> 'linkedinUrl'), ''),
          nullif(btrim(canonical ->> 'websiteUrl'), ''),
          case when classification_value = 'alumni' then 'alumni' else 'current' end,
          classification_value,
          media_record.public_id,
          media_record.secure_url,
          media_record.format,
          media_record.bytes,
          media_record.width,
          media_record.height,
          case when media_record.id is not null then now_value else null end,
          case when media_record.id is not null then actor_id else null end
        )
        returning * into member_record;
        member_id_value := member_record.id;
        member_action := 'created';
        created_members := created_members + 1;
      elsif identity_data ->> 'kind' = 'update' then
        expected_member_id := nullif(identity_data ->> 'memberId', '')::uuid;
        if expected_member_id is null
           or id_match is distinct from expected_member_id
           or email_match is distinct from expected_member_id then
          raise exception 'Draft row % identity changed after validation.', row_record.row_number
            using errcode = '40001';
        end if;

        select * into member_record
        from public.members
        where id = expected_member_id
        for update;
        if target_versions ->> 'memberUpdatedAt' is null
           or member_record.updated_at is distinct from
             (target_versions ->> 'memberUpdatedAt')::timestamptz then
          raise exception 'Draft row % member changed after validation.', row_record.row_number
            using errcode = '40001';
        end if;

        if member_record.full_name is distinct from full_name_value
           or member_record.member_type is distinct from
             (case when classification_value = 'alumni' then 'alumni' else 'current' end)
           or member_record.lifecycle_status is distinct from classification_value
           or (department_value is not null and member_record.department_code is distinct from department_value)
           or (canonical ? 'batchNo' and member_record.batch_no is distinct from batch_value)
           or (canonical ? 'joinedOn' and member_record.joined_on is distinct from joined_value)
           or (nullif(btrim(canonical ->> 'phone'), '') is not null
               and member_record.phone is distinct from nullif(btrim(canonical ->> 'phone'), ''))
           or (nullif(btrim(canonical ->> 'studentId'), '') is not null
               and member_record.student_id is distinct from nullif(btrim(canonical ->> 'studentId'), ''))
           or (nullif(btrim(canonical ->> 'facebookUrl'), '') is not null
               and member_record.facebook_url is distinct from nullif(btrim(canonical ->> 'facebookUrl'), ''))
           or (nullif(btrim(canonical ->> 'linkedinUrl'), '') is not null
               and member_record.linkedin_url is distinct from nullif(btrim(canonical ->> 'linkedinUrl'), ''))
           or (nullif(btrim(canonical ->> 'websiteUrl'), '') is not null
               and member_record.website_url is distinct from nullif(btrim(canonical ->> 'websiteUrl'), ''))
           or (media_record.id is not null and (
             member_record.avatar_public_id is distinct from media_record.public_id
             or member_record.avatar_secure_url is distinct from media_record.secure_url
           )) then
          update public.members
          set full_name = full_name_value,
              member_type = case when classification_value = 'alumni' then 'alumni' else 'current' end,
              lifecycle_status = classification_value,
              lifecycle_changed_at = case
                when member_record.lifecycle_status is distinct from classification_value then now_value
                else member_record.lifecycle_changed_at end,
              lifecycle_changed_by_user_id = case
                when member_record.lifecycle_status is distinct from classification_value then actor_id
                else member_record.lifecycle_changed_by_user_id end,
              department_code = coalesce(department_value, member_record.department_code),
              batch_no = case when canonical ? 'batchNo' then batch_value else member_record.batch_no end,
              joined_on = case when canonical ? 'joinedOn' then joined_value else member_record.joined_on end,
              phone = coalesce(nullif(btrim(canonical ->> 'phone'), ''), member_record.phone),
              student_id = coalesce(nullif(btrim(canonical ->> 'studentId'), ''), member_record.student_id),
              facebook_url = coalesce(nullif(btrim(canonical ->> 'facebookUrl'), ''), member_record.facebook_url),
              linkedin_url = coalesce(nullif(btrim(canonical ->> 'linkedinUrl'), ''), member_record.linkedin_url),
              website_url = coalesce(nullif(btrim(canonical ->> 'websiteUrl'), ''), member_record.website_url),
              avatar_public_id = case when media_record.id is not null then media_record.public_id else member_record.avatar_public_id end,
              avatar_secure_url = case when media_record.id is not null then media_record.secure_url else member_record.avatar_secure_url end,
              avatar_format = case when media_record.id is not null then media_record.format else member_record.avatar_format end,
              avatar_bytes = case when media_record.id is not null then media_record.bytes else member_record.avatar_bytes end,
              avatar_width = case when media_record.id is not null then media_record.width else member_record.avatar_width end,
              avatar_height = case when media_record.id is not null then media_record.height else member_record.avatar_height end,
              avatar_updated_at = case when media_record.id is not null then now_value else member_record.avatar_updated_at end,
              avatar_updated_by_user_id = case when media_record.id is not null then actor_id else member_record.avatar_updated_by_user_id end
          where id = member_record.id
          returning * into member_record;
          member_action := 'updated';
          updated_members := updated_members + 1;
        end if;
        member_id_value := member_record.id;
      else
        raise exception 'Draft row % has an unresolved identity.', row_record.row_number
          using errcode = '22023';
      end if;

      processed_members := jsonb_set(
        processed_members,
        array[lower(jnuits_id_value)],
        to_jsonb(member_id_value::text),
        true
      );
    end if;

    assignment_action := null;
    assignment_id_value := null;
    if operation.operation_type = 'committee_roster_import' then
      assignment_data := row_record.normalized_data -> 'assignment';
      assignment_patch := row_record.normalized_data -> 'assignmentPatch';
      if jsonb_typeof(assignment_data) <> 'object'
         or jsonb_typeof(assignment_patch) <> 'object' then
        raise exception 'Draft row % has no valid appointment payload.', row_record.row_number
          using errcode = '22023';
      end if;

      term_id_value := nullif(assignment_data ->> 'termId', '')::uuid;
      role_id_value := nullif(assignment_data ->> 'roleId', '')::uuid;
      if term_id_value is distinct from operation.target_term_id or role_id_value is null then
        raise exception 'Draft row % targets a different committee term.', row_record.row_number
          using errcode = '22023';
      end if;

      select * into position_record
      from public.committee_term_positions
      where term_id = term_id_value and role_id = role_id_value
      for update;
      if not found then
        raise exception 'Draft row % references an unknown committee position.', row_record.row_number
          using errcode = '23503';
      end if;
      if target_versions ->> 'positionUpdatedAt' is null
         or position_record.updated_at is distinct from
           (target_versions ->> 'positionUpdatedAt')::timestamptz then
        raise exception 'Draft row % position changed after validation.', row_record.row_number
          using errcode = '40001';
      end if;

      if assignment_patch ->> 'starts_on' is not null
         and assignment_patch ->> 'starts_on' !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'Draft row % has an invalid appointment start date.', row_record.row_number
          using errcode = '22023';
      end if;
      if assignment_patch ->> 'ends_on' is not null
         and assignment_patch ->> 'ends_on' !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'Draft row % has an invalid appointment end date.', row_record.row_number
          using errcode = '22023';
      end if;
      starts_value := nullif(assignment_patch ->> 'starts_on', '')::date;
      ends_value := nullif(assignment_patch ->> 'ends_on', '')::date;
      if starts_value is not null and ends_value is not null and ends_value < starts_value then
        raise exception 'Draft row % appointment ends before it starts.', row_record.row_number
          using errcode = '22023';
      end if;
      if assignment_patch ->> 'sort_order' !~ '^\d+$' then
        raise exception 'Draft row % has an invalid appointment order.', row_record.row_number
          using errcode = '22023';
      end if;
      sort_value := (assignment_patch ->> 'sort_order')::integer;
      if jsonb_typeof(assignment_patch -> 'is_public') <> 'boolean' then
        raise exception 'Draft row % has an invalid public flag.', row_record.row_number
          using errcode = '22023';
      end if;
      public_value := (assignment_patch ->> 'is_public')::boolean;
      assignment_status_value := assignment_patch ->> 'status';
      if assignment_status_value not in ('planned', 'active', 'completed') then
        raise exception 'Draft row % has an invalid appointment status.', row_record.row_number
          using errcode = '22023';
      end if;

      assignment_record := null;
      select * into assignment_record
      from public.committee_assignments
      where term_id = term_id_value
        and role_id = role_id_value
        and member_id = member_id_value
      for update;

      if assignment_status_value in ('planned', 'active') and (
        select count(*)
        from public.committee_assignments as occupied
        where occupied.term_id = term_id_value
          and occupied.role_id = role_id_value
          and occupied.status in ('planned', 'active')
          and (
            assignment_record.id is null
            or occupied.id <> assignment_record.id
          )
      ) >= position_record.max_slots then
        raise exception 'Draft row % exceeds the configured seat limit.', row_record.row_number
          using errcode = '23514';
      end if;

      if assignment_data ->> 'action' = 'create' then
        if assignment_record.id is not null then
          raise exception 'Draft row % appointment changed after validation.', row_record.row_number
            using errcode = '40001';
        end if;
        insert into public.committee_assignments (
          term_id,
          role_id,
          member_id,
          sort_order,
          starts_on,
          ends_on,
          status,
          is_public,
          source,
          import_batch_id,
          metadata,
          created_by_user_id
        ) values (
          term_id_value,
          role_id_value,
          member_id_value,
          sort_value,
          starts_value,
          ends_value,
          assignment_status_value,
          public_value,
          'bulk_import',
          operation.id,
          jsonb_build_object('onboardingOperationId', operation.id),
          actor_id
        )
        returning * into assignment_record;
        assignment_action := 'created';
        created_assignments := created_assignments + 1;
      elsif assignment_data ->> 'action' in ('update', 'noop') then
        expected_assignment_id := nullif(assignment_data ->> 'assignmentId', '')::uuid;
        if assignment_record.id is null
           or assignment_record.id is distinct from expected_assignment_id
           or target_versions ->> 'assignmentUpdatedAt' is null
           or assignment_record.updated_at is distinct from
             (target_versions ->> 'assignmentUpdatedAt')::timestamptz then
          raise exception 'Draft row % appointment changed after validation.', row_record.row_number
            using errcode = '40001';
        end if;

        if assignment_data ->> 'action' = 'noop' and (
          assignment_record.sort_order is distinct from sort_value
          or assignment_record.starts_on is distinct from starts_value
          or assignment_record.ends_on is distinct from ends_value
          or assignment_record.status is distinct from assignment_status_value
          or assignment_record.is_public is distinct from public_value
        ) then
          raise exception 'Draft row % no-op appointment changed after validation.', row_record.row_number
            using errcode = '40001';
        end if;

        if assignment_record.sort_order is distinct from sort_value
           or assignment_record.starts_on is distinct from starts_value
           or assignment_record.ends_on is distinct from ends_value
           or assignment_record.status is distinct from assignment_status_value
           or assignment_record.is_public is distinct from public_value then
          update public.committee_assignments
          set sort_order = sort_value,
              starts_on = starts_value,
              ends_on = ends_value,
              status = assignment_status_value,
              is_public = public_value,
              source = 'bulk_import',
              import_batch_id = operation.id,
              metadata = coalesce(assignment_record.metadata, '{}'::jsonb) ||
                jsonb_build_object('onboardingOperationId', operation.id)
          where id = assignment_record.id
          returning * into assignment_record;
          assignment_action := 'updated';
          updated_assignments := updated_assignments + 1;
        else
          assignment_action := 'noop';
        end if;
      else
        raise exception 'Draft row % has an invalid appointment action.', row_record.row_number
          using errcode = '22023';
      end if;
      assignment_id_value := assignment_record.id;
    end if;

    if member_action = 'noop'
       and (operation.operation_type = 'member_profile_import' or assignment_action = 'noop') then
      noop_rows := noop_rows + 1;
    end if;

    update public.bulk_operation_rows
    set status = 'committed',
        result = jsonb_strip_nulls(jsonb_build_object(
          'memberId', member_id_value,
          'memberAction', member_action,
          'assignmentId', assignment_id_value,
          'assignmentAction', assignment_action
        ))
    where id = row_record.id;
  end loop;

  update public.bulk_operation_rows
  set status = 'skipped',
      result = jsonb_build_object('reason', 'excluded')
  where operation_id = operation.id and is_excluded;

  if p_make_current then
    update public.committee_terms
    set is_current = false
    where term_kind = 'executive'
      and id <> operation.target_term_id
      and is_current;

    update public.committee_terms
    set is_current = true,
        is_public = true,
        status = 'active'
    where id = operation.target_term_id;
  end if;

  result_payload := jsonb_build_object(
    'operationId', operation.id,
    'operationType', operation.operation_type,
    'draftRevision', operation.draft_revision,
    'committedRows', active_rows,
    'createdMembers', created_members,
    'updatedMembers', updated_members,
    'createdAssignments', created_assignments,
    'updatedAssignments', updated_assignments,
    'noopRows', noop_rows,
    'madeCurrent', p_make_current
  );

  update public.bulk_operations
  set status = 'committed',
      committed_rows = active_rows,
      committed_at = now_value,
      committed_by_user_id = actor_id,
      metadata = jsonb_set(
        coalesce(operation.metadata, '{}'::jsonb),
        '{commitResult}',
        result_payload,
        true
      )
  where id = operation.id;

  insert into public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    actor_id,
    case when operation.operation_type = 'committee_roster_import'
      then 'committee.onboarding_draft_committed'
      else 'member.onboarding_draft_committed' end,
    'bulk_operation',
    operation.id::text,
    result_payload
  );

  return jsonb_build_object(
    'status', 'committed',
    'operationId', operation.id,
    'result', result_payload
  );
end;
$function$;

revoke all on function public.commit_onboarding_draft(uuid, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.commit_onboarding_draft(uuid, integer, boolean)
  to authenticated, service_role;

notify pgrst, 'reload schema';
commit;


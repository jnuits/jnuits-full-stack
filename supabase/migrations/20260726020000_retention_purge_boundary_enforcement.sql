-- Forward-only migration. UNAPPLIED until explicit approval.
--
-- Binds retention purge to the exact three-year boundary recorded inside the
-- HMAC-signed archive manifest.
--
-- Before this change purge_retention_job filtered only by resource:
--   update public.form_submissions ... where form_definition_id = v_resource_id;
-- which destroyed PII for EVERY submission of that form, including records
-- created days earlier, as soon as one three-year-old submission existed.
--
-- The function signature is unchanged (text, uuid, uuid) so no application
-- caller changes and no generated types move. Purge is now impossible unless a
-- verified boundary is present, so an unbounded legacy manifest fails closed
-- instead of over-purging. Aggregate rows are preserved (columns are nulled,
-- rows are never deleted), audit records remain append-only, and Cloudinary
-- originals are never touched.

begin;

create or replace function public.purge_retention_job(
  p_scope text,
  p_job_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_boundary timestamptz;
  v_boundary_text text;
  v_legacy_event_post_id uuid;
  v_now timestamptz := clock_timestamp();
  v_purged_rows integer := 0;
  v_registration_rows integer := 0;
  v_resource_id uuid;
begin
  if p_actor_user_id is null then
    raise exception 'Retention purge actor is required.';
  end if;

  if p_scope = 'form' then
    select job.form_definition_id,
           job.archive_manifest -> 'manifest' ->> 'boundary'
    into v_resource_id, v_boundary_text
    from public.form_archive_jobs as job
    where job.id = p_job_id
      and job.status = 'purge_approved'
      and job.approved_at is not null
      and job.approved_by_user_id is not null
      and job.manifest_checksum_sha256 is not null
      and job.archive_manifest <> '{}'::jsonb
    for update;

    if v_resource_id is null then
      raise exception 'Form retention job is not approved for purge.';
    end if;

    if v_boundary_text is null then
      raise exception 'Retention purge requires a verified archive boundary.'
        using errcode = '22023';
    end if;

    v_boundary := v_boundary_text::timestamptz;

    update public.form_submissions
    set answers = '{}'::jsonb,
        source_metadata = '{}'::jsonb,
        submitter_email = null,
        confirmation_token_hash = null,
        confirmation_expires_at = null,
        updated_at = v_now
    where form_definition_id = v_resource_id
      and created_at <= v_boundary;

    get diagnostics v_purged_rows = row_count;

    update public.form_archive_jobs
    set status = 'purged',
        source_pii_purged_at = v_now,
        error_code = null
    where id = p_job_id;
  elsif p_scope = 'event' then
    select job.event_id,
           event.legacy_content_post_id,
           job.archive_manifest -> 'manifest' ->> 'boundary'
    into v_resource_id, v_legacy_event_post_id, v_boundary_text
    from public.event_retention_jobs as job
    join public.events as event on event.id = job.event_id
    where job.id = p_job_id
      and job.status = 'purge_approved'
      and job.approved_at is not null
      and job.approved_by_user_id is not null
      and job.manifest_checksum_sha256 is not null
      and job.archive_manifest <> '{}'::jsonb
    for update of job;

    if v_resource_id is null then
      raise exception 'Event retention job is not approved for purge.';
    end if;

    if v_boundary_text is null then
      raise exception 'Retention purge requires a verified archive boundary.'
        using errcode = '22023';
    end if;

    v_boundary := v_boundary_text::timestamptz;

    update public.form_submissions as submission
    set answers = '{}'::jsonb,
        source_metadata = '{}'::jsonb,
        submitter_email = null,
        confirmation_token_hash = null,
        confirmation_expires_at = null,
        updated_at = v_now
    where submission.event_registration_id in (
      select registration.id
      from public.event_registrations as registration
      where registration.created_at <= v_boundary
        and (
          registration.event_id = v_resource_id
          or (
            v_legacy_event_post_id is not null
            and registration.event_post_id = v_legacy_event_post_id
          )
        )
    );

    get diagnostics v_purged_rows = row_count;

    update public.event_registrations as registration
    set registrant_name = 'Purged registrant',
        registrant_email =
          'purged-' || registration.id::text || '@retained.invalid',
        registrant_phone = null
    where registration.created_at <= v_boundary
      and (
        registration.event_id = v_resource_id
        or (
          v_legacy_event_post_id is not null
          and registration.event_post_id = v_legacy_event_post_id
        )
      );

    get diagnostics v_registration_rows = row_count;

    update public.event_retention_jobs
    set status = 'purged',
        source_pii_purged_at = v_now,
        error_code = null
    where id = p_job_id;
  else
    raise exception 'Retention purge scope is invalid.';
  end if;

  insert into public.audit_events (
    action,
    actor_user_id,
    entity_id,
    entity_type,
    metadata
  )
  values (
    'retention.source_pii_purged',
    p_actor_user_id,
    v_resource_id,
    'retention_job',
    jsonb_build_object(
      'boundary', v_boundary,
      'cloudinary_originals_retained', true,
      'job_id', p_job_id,
      'purged_registration_rows', v_registration_rows,
      'purged_rows', v_purged_rows,
      'scope', p_scope
    )
  );

  return jsonb_build_object(
    'boundary', v_boundary,
    'purgedRegistrationRows', v_registration_rows,
    'purgedRows', v_purged_rows,
    'resourceId', v_resource_id,
    'scope', p_scope,
    'success', true
  );
end;
$function$;

revoke all on function public.purge_retention_job(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.purge_retention_job(text, uuid, uuid)
  to service_role;

commit;

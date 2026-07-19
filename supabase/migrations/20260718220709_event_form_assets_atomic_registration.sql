-- Local migration only. Do not apply to any Supabase project without explicit
-- approval, pre-production migration parity, and RLS/advisor verification.

begin;

create or replace function public.register_for_event_with_form_assets_atomic(
  p_event_id uuid,
  p_legacy_event_post_id uuid,
  p_member_id uuid,
  p_registrant_name text,
  p_registrant_email text,
  p_registrant_phone text,
  p_form_definition_id uuid,
  p_form_version_id uuid,
  p_answers jsonb,
  p_assets jsonb
)
returns table(result_status text, registration_code text)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_result record;
  v_submission_id uuid;
begin
  if coalesce(jsonb_typeof(p_assets), '') <> 'array'
    or jsonb_array_length(p_assets) > 25
  then
    return query select 'invalid'::text, null::text;
    return;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assets) as asset
    where jsonb_typeof(asset) <> 'object'
      or coalesce(asset->>'fieldId', '') !~ '^[a-z][a-z0-9_]{0,63}$'
      or coalesce(asset->>'cloudinaryAssetId', '') !~ '^[a-f0-9]{32}$'
      or length(coalesce(asset->>'cloudinaryPublicId', '')) not between 1 and 255
      or length(coalesce(asset->>'cloudinaryFolder', '')) not between 1 and 180
      or coalesce(asset->>'cloudinaryVersion', '') !~ '^[0-9]+$'
      or coalesce(asset->>'contentType', '') not in (
        'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
      )
      or coalesce(asset->>'sha256', '') !~ '^[a-f0-9]{64}$'
      or not (
        case
          when coalesce(asset->>'bytes', '') ~ '^[1-9][0-9]{0,7}$'
            then (asset->>'bytes')::integer <= 10485760
          else false
        end
      )
  ) then
    return query select 'invalid'::text, null::text;
    return;
  end if;

  select *
  into v_result
  from public.register_for_event_with_form_atomic(
    p_event_id,
    p_legacy_event_post_id,
    p_member_id,
    p_registrant_name,
    p_registrant_email,
    p_registrant_phone,
    p_form_definition_id,
    p_form_version_id,
    p_answers
  );

  if v_result.result_status not in ('confirmed', 'waitlisted') then
    return query select v_result.result_status::text, v_result.registration_code::text;
    return;
  end if;

  if jsonb_array_length(p_assets) = 0 then
    return query select v_result.result_status::text, v_result.registration_code::text;
    return;
  end if;

  select submission.id
  into v_submission_id
  from public.form_submissions as submission
  join public.event_registrations as registration
    on registration.id = submission.event_registration_id
  where registration.event_id = p_event_id
    and registration.registration_code = v_result.registration_code
    and submission.form_definition_id = p_form_definition_id
    and submission.form_version_id = p_form_version_id
  for key share of submission;

  if v_submission_id is null then
    raise exception 'Event form submission missing after atomic registration.';
  end if;

  insert into public.form_submission_assets (
    form_submission_id,
    field_id,
    cloudinary_asset_id,
    cloudinary_public_id,
    cloudinary_version,
    cloudinary_folder,
    content_type,
    bytes,
    sha256
  )
  select
    v_submission_id,
    asset->>'fieldId',
    asset->>'cloudinaryAssetId',
    asset->>'cloudinaryPublicId',
    asset->>'cloudinaryVersion',
    asset->>'cloudinaryFolder',
    asset->>'contentType',
    (asset->>'bytes')::integer,
    asset->>'sha256'
  from jsonb_array_elements(p_assets) as asset;

  return query select v_result.result_status::text, v_result.registration_code::text;
end;
$function$;

revoke all on function public.register_for_event_with_form_assets_atomic(
  uuid, uuid, uuid, text, text, text, uuid, uuid, jsonb, jsonb
) from public;
revoke all on function public.register_for_event_with_form_assets_atomic(
  uuid, uuid, uuid, text, text, text, uuid, uuid, jsonb, jsonb
) from anon;
revoke all on function public.register_for_event_with_form_assets_atomic(
  uuid, uuid, uuid, text, text, text, uuid, uuid, jsonb, jsonb
) from authenticated;
grant execute on function public.register_for_event_with_form_assets_atomic(
  uuid, uuid, uuid, text, text, text, uuid, uuid, jsonb, jsonb
) to service_role;

commit;
alter table public.profile_update_requests
drop constraint if exists profile_update_requests_request_type_check;

alter table public.profile_update_requests
add constraint profile_update_requests_request_type_check
check (
  request_type = any (
    array[
      'workplace_update'::text,
      'profile_change'::text,
      'email_change'::text,
      'jnuits_id_change'::text
    ]
  )
);

begin;

create or replace function public.find_auth_user_id_by_email(target_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select user_record.id
  from auth.users as user_record
  where user_record.email is not null
    and lower(user_record.email) = lower(trim(target_email))
  limit 1;
$$;

revoke all on function public.find_auth_user_id_by_email(text) from public;
revoke all on function public.find_auth_user_id_by_email(text) from anon, authenticated;
grant execute on function public.find_auth_user_id_by_email(text) to service_role;

comment on function public.find_auth_user_id_by_email(text) is
  'Server-only Auth email lookup for member-claim collision checks. Returns only a user UUID.';

commit;
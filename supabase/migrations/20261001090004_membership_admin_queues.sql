-- Read-only operator queue DTO; authorization is enforced in the server DAL.
-- Dates, overdue duration and upcoming classification stay in PostgreSQL.
create function public.get_membership_admin_queue(
  p_queue text, p_page integer default 1, p_page_size integer default 25,
  p_effective_date date default (now() at time zone 'Asia/Dhaka')::date
)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $function$
declare result jsonb;
begin
  if p_queue is null or p_queue not in ('unknown', 'upcoming', 'overdue', 'renewal', 'departure', 'appeal', 'alumni')
    or p_page is null or p_page < 1 or p_page > 10000 or p_page_size is null or p_page_size < 1 or p_page_size > 50
    or p_effective_date is null then raise exception 'Invalid bounded queue parameters.' using errcode = '22023'; end if;
  with matching as materialized (
    select m.id as member_id, m.full_name, m.jnuits_id, m.joined_on, m.renewal_due_on,
      m.lifecycle_status, m.portal_access_status, m.current_membership_path_status,
      greatest(0, p_effective_date - m.renewal_due_on) as overdue_days,
      r.id as request_id, r.request_type, r.requested_at, r.updated_at as request_updated_at,
      left(r.payload ->> 'note', 500) as request_note
    from public.members m
    left join lateral (
      select q.id, q.request_type, q.requested_at, q.updated_at, q.payload
      from public.profile_update_requests q where q.member_id = m.id and q.status = 'pending'
        and q.request_type = case p_queue when 'renewal' then 'membership_renewal' when 'departure' then 'membership_departure'
          when 'appeal' then 'membership_departure_appeal' when 'alumni' then 'alumni_conversion' else null end
      order by q.requested_at, q.id limit 1
    ) r on true
    where m.lifecycle_status in ('current', 'former') and m.jnuits_id not ilike 'JNUITS-ADMIN-%'
      and case p_queue
        when 'unknown' then m.joined_on is null
        when 'upcoming' then m.current_membership_path_status = 'open' and m.renewal_due_on > p_effective_date and m.renewal_due_on <= p_effective_date + 30
        when 'overdue' then m.current_membership_path_status = 'open' and m.renewal_due_on <= p_effective_date
        else r.id is not null end
  ), page_rows as (
    select * from matching order by requested_at asc nulls last, renewal_due_on asc nulls first, member_id
    offset ((p_page - 1) * p_page_size) limit p_page_size
  )
  select jsonb_build_object('total', (select count(*) from matching), 'rows', coalesce((
    select jsonb_agg(jsonb_build_object(
      'memberId', member_id, 'fullName', full_name, 'jnuitsId', jnuits_id, 'joinedOn', joined_on, 'dueOn', renewal_due_on,
      'lifecycleStatus', lifecycle_status, 'portalAccessStatus', portal_access_status, 'pathStatus', current_membership_path_status,
      'overdueDays', overdue_days, 'requestId', request_id, 'requestType', request_type, 'requestedAt', requested_at,
      'requestUpdatedAt', request_updated_at, 'requestNote', request_note
    ) order by requested_at asc nulls last, renewal_due_on asc nulls first, member_id) from page_rows
  ), '[]'::jsonb)) into result;
  return result;
end;
$function$;
revoke all on function public.get_membership_admin_queue(text, integer, integer, date) from public, anon, authenticated;
grant execute on function public.get_membership_admin_queue(text, integer, integer, date) to service_role;

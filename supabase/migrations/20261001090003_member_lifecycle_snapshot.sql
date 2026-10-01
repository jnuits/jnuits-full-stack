begin;
set local lock_timeout = '5s';

-- Server-only read projection. The Next.js DAL verifies the authenticated owner
-- before passing the canonical member ID. No browser receives service credentials.
-- Date classification stays beside the authoritative renewal functions.
create function public.get_member_membership_state(p_member_id uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $function$
  select jsonb_build_object(
    'memberId', m.id, 'fullName', m.full_name, 'jnuitsId', m.jnuits_id,
    'avatarSecureUrl', m.avatar_secure_url,
    'joinedOn', m.joined_on, 'renewalDueOn', m.renewal_due_on,
    'graceEndsOn', (m.renewal_due_on + interval '6 months')::date,
    'renewalState', public.membership_renewal_state(m.renewal_due_on, m.lifecycle_status, (now() at time zone 'Asia/Dhaka')::date),
    'lifecycleStatus', m.lifecycle_status, 'memberType', m.member_type,
    'portalAccessStatus', m.portal_access_status,
    'currentMembershipPathStatus', m.current_membership_path_status,
    'revision', m.membership_revision, 'currentCaseId', m.current_membership_case_id,
    'appealId', m.current_membership_appeal_id, 'closedOn', m.current_membership_closed_on,
    'closureReason', case when m.current_membership_closure_reason in
      ('voluntary_departure', 'departure_appeal_rejected', 'alumni_conversion') then m.current_membership_closure_reason else null end
  ) from public.members m where m.id = p_member_id;
$function$;
revoke all on function public.get_member_membership_state(uuid) from public, anon, authenticated;
grant execute on function public.get_member_membership_state(uuid) to service_role;
commit;

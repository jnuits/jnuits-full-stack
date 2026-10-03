-- Private adoption preference; never an authorization or verification proof.
create function public.admin_verification_suggestion(p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare ctx jsonb; actor jsonb; snoozed timestamptz; actor_id uuid;
begin
  if jsonb_typeof(p_input) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_input))<>2
    or jsonb_typeof(p_input->'snooze') is distinct from 'boolean' or not (p_input ? 'actor') then
    return jsonb_build_object('ok',false,'code','invalid_input');
  end if;
  ctx:=private.admin_verification_actor_context(p_input->'actor');
  if not coalesce((ctx->>'ok')::boolean,false) then return ctx; end if;
  actor:=ctx->'value'; actor_id:=(actor->>'userId')::uuid;
  if (p_input->>'snooze')::boolean then
    insert into private.admin_verification_preferences(user_id,snoozed_until)
      values(actor_id,clock_timestamp()+interval '168 hours')
      on conflict(user_id) do update set snoozed_until=excluded.snoozed_until
      returning snoozed_until into snoozed;
  else
    select snoozed_until into snoozed from private.admin_verification_preferences where user_id=actor_id;
  end if;
  return jsonb_build_object('ok',true,'value',jsonb_build_object(
    'show',actor->>'enrollment'<>'enrolled' and (snoozed is null or snoozed<=clock_timestamp()),
    'snoozedUntil',snoozed));
end;
$fn$;
revoke all on function public.admin_verification_suggestion(jsonb) from public,anon,authenticated;
grant execute on function public.admin_verification_suggestion(jsonb) to service_role;
notify pgrst,'reload schema';

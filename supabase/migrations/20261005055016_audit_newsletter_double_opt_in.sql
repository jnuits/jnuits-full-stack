-- Separate newsletter consent from membership, Auth and admin operation proofs.
begin;
create table private.newsletter_subscriptions(
  id uuid primary key default extensions.gen_random_uuid(),
  email extensions.citext not null unique check(length(email::text)<=254),
  consent_version text not null default '2026-10-04',
  consented_at timestamptz not null default now(),
  confirmed_at timestamptz,
  state text not null default 'pending' check(state in ('pending','active','preferences_required','suppressed')),
  provider_contact_id text,
  lease_id uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now()
);
create table private.newsletter_confirmation_tokens(
  id uuid primary key,
  subscription_id uuid not null references private.newsletter_subscriptions(id) on delete cascade,
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null default now()+interval '24 hours',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  used_at timestamptz,
  provider_message_id text unique,
  delivery_status text not null default 'pending' check(delivery_status in ('pending','sent','delivered','delayed','failed','bounced','complained'))
);
create index newsletter_confirmation_attempts_idx on private.newsletter_confirmation_tokens(subscription_id,created_at desc);
create table private.newsletter_delivery_events(
  provider_event_id text primary key,
  token_id uuid not null references private.newsletter_confirmation_tokens(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now()
);
alter table private.newsletter_subscriptions enable row level security;
alter table private.newsletter_confirmation_tokens enable row level security;
alter table private.newsletter_delivery_events enable row level security;
revoke all on private.newsletter_subscriptions,private.newsletter_confirmation_tokens,private.newsletter_delivery_events from public,anon,authenticated,service_role;

-- The only Data API boundary: explicit service execution, pinned path and an
-- invoker-role guard. Server-owned private rows cannot be read via browser RPC.
create function public.newsletter_store(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $newsletter$
declare
  subscription private.newsletter_subscriptions;
  confirmation private.newsletter_confirmation_tokens;
  normalized_email extensions.citext;
  last_attempt timestamptz;
  attempt_count integer;
  result_status text;
  changed integer;
begin
  if current_setting('role',true) is distinct from 'service_role' then
    raise insufficient_privilege using message='Service caller required';
  end if;
  if p_action='subscribe' then
    normalized_email := lower(btrim(p_payload->>'email'));
    if normalized_email is null or normalized_email::text !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      or length(normalized_email::text)>254 or (p_payload->>'token_hash') !~ '^[a-f0-9]{64}$' then
      raise invalid_parameter_value using message='Invalid newsletter input';
    end if;
    insert into private.newsletter_subscriptions(email) values(normalized_email) on conflict(email) do nothing;
    select * into subscription from private.newsletter_subscriptions where email=normalized_email for update;
    if subscription.state in ('active','suppressed') or subscription.lease_expires_at>now() then
      return jsonb_build_object('status','ignored');
    end if;
    select max(created_at),count(*) filter(where created_at>now()-interval '1 hour')
      into last_attempt,attempt_count from private.newsletter_confirmation_tokens where subscription_id=subscription.id;
    if last_attempt>now()-interval '60 seconds' or attempt_count>=3 then
      return jsonb_build_object('status','limited');
    end if;
    insert into private.newsletter_confirmation_tokens(id,subscription_id,token_hash)
      values((p_payload->>'token_id')::uuid,subscription.id,p_payload->>'token_hash') returning * into confirmation;
    update private.newsletter_subscriptions set consented_at=now(),state='pending' where id=subscription.id;
    return jsonb_build_object('status','send','token_id',confirmation.id);
  elsif p_action='delivery' then
    update private.newsletter_confirmation_tokens set
      sent_at=case when (p_payload->>'success')::boolean then coalesce(sent_at,now()) else sent_at end,
      provider_message_id=coalesce(p_payload->>'message_id',provider_message_id),
      delivery_status=case when delivery_status in ('delivered','bounced','complained') then delivery_status
        when (p_payload->>'success')::boolean then 'sent' else 'failed' end
      where id=(p_payload->>'token_id')::uuid;
    get diagnostics changed=row_count;
    if changed<>1 then raise invalid_parameter_value using message='Unknown newsletter delivery'; end if;
    return jsonb_build_object('status','recorded');
  elsif p_action='prepare' then
    select * into confirmation from private.newsletter_confirmation_tokens where token_hash=p_payload->>'token_hash';
    if not found then return jsonb_build_object('status','invalid_token'); end if;
    select * into subscription from private.newsletter_subscriptions where id=confirmation.subscription_id for update;
    select * into confirmation from private.newsletter_confirmation_tokens where id=confirmation.id for update;
    if confirmation.used_at is not null then
      return jsonb_build_object('status',case when subscription.state='active' then 'confirmed' else 'preferences_required' end);
    end if;
    if confirmation.expires_at<=now() then return jsonb_build_object('status','expired_token'); end if;
    if confirmation.sent_at is null or confirmation.delivery_status='failed' then return jsonb_build_object('status','newsletter_unavailable'); end if;
    if subscription.state in ('active','suppressed') then
      update private.newsletter_confirmation_tokens set used_at=now() where id=confirmation.id;
      return jsonb_build_object('status',case when subscription.state='active' then 'confirmed' else 'preferences_required' end);
    end if;
    if subscription.lease_expires_at>now() then return jsonb_build_object('status','newsletter_unavailable'); end if;
    update private.newsletter_subscriptions set confirmed_at=coalesce(confirmed_at,now()),
      lease_id=(p_payload->>'attempt_id')::uuid,lease_expires_at=now()+interval '120 seconds'
      where id=subscription.id;
    return jsonb_build_object('status','ready','email',subscription.email,'token_id',confirmation.id,'subscription_id',subscription.id);
  elsif p_action='finish' then
    select * into subscription from private.newsletter_subscriptions where id=(p_payload->>'subscription_id')::uuid for update;
    if not found or subscription.lease_id is distinct from (p_payload->>'attempt_id')::uuid
      or subscription.lease_expires_at<=now() then return jsonb_build_object('status','newsletter_unavailable'); end if;
    select * into confirmation from private.newsletter_confirmation_tokens
      where id=(p_payload->>'token_id')::uuid and subscription_id=subscription.id for update;
    if not found then raise invalid_parameter_value using message='Unknown confirmation'; end if;
    result_status := p_payload->>'status';
    if result_status not in ('confirmed','preferences_required','pending') or result_status is null then
      raise invalid_parameter_value using message='Invalid sync result';
    end if;
    if subscription.state='suppressed' then result_status:='preferences_required'; end if;
    update private.newsletter_subscriptions set
      state=case when state='suppressed' then state when result_status='confirmed' then 'active' else result_status end,
      provider_contact_id=coalesce(p_payload->>'contact_id',provider_contact_id),lease_id=null,lease_expires_at=null where id=subscription.id;
    if result_status<>'pending' then update private.newsletter_confirmation_tokens set used_at=now() where id=confirmation.id; end if;
    return jsonb_build_object('status',case when result_status='pending' then 'newsletter_unavailable' else result_status end);
  elsif p_action='webhook' then
    select * into confirmation from private.newsletter_confirmation_tokens where provider_message_id=p_payload->>'message_id';
    if not found then return jsonb_build_object('tracked',false,'duplicate',false); end if;
    select * into subscription from private.newsletter_subscriptions where id=confirmation.subscription_id for update;
    insert into private.newsletter_delivery_events(provider_event_id,token_id,event_type,occurred_at)
      values(p_payload->>'event_id',confirmation.id,p_payload->>'event_type',(p_payload->>'occurred_at')::timestamptz)
      on conflict(provider_event_id) do nothing;
    get diagnostics changed=row_count;
    if changed=0 then return jsonb_build_object('tracked',true,'duplicate',true); end if;
    result_status:=p_payload->>'delivery_status';
    if result_status in ('sent','delivered','delayed','failed','bounced','complained') then
      update private.newsletter_confirmation_tokens set delivery_status=case
        when delivery_status in ('bounced','complained') then delivery_status
        when result_status in ('bounced','complained') then result_status
        when delivery_status='delivered' then delivery_status else result_status end where id=confirmation.id;
      if result_status in ('bounced','complained') then
        update private.newsletter_subscriptions set state='suppressed' where id=subscription.id;
      end if;
    end if;
    return jsonb_build_object('tracked',true,'duplicate',false);
  end if;
  raise invalid_parameter_value using message='Unknown newsletter operation';
end;
$newsletter$;
revoke all on function public.newsletter_store(text,jsonb) from public,anon,authenticated;
grant execute on function public.newsletter_store(text,jsonb) to service_role;
commit;

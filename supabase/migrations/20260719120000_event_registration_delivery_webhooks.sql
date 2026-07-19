-- Local-only until explicit production migration approval.
-- Durable Resend delivery tracking for event confirmation and waitlist messages.

create table if not exists public.event_registration_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  registration_code text not null
    references public.event_registrations(registration_code) on delete restrict,
  idempotency_key text not null unique,
  status text not null,
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  last_provider_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_registration_deliveries_status_check
    check (status in (
      'pending', 'sent', 'delivered', 'delayed', 'failed', 'bounced', 'complained'
    ))
);

create index if not exists event_registration_deliveries_registration_idx
  on public.event_registration_deliveries (registration_code, created_at desc);

create index if not exists event_registration_deliveries_event_id_idx
  on public.event_registration_deliveries (event_id);

create index if not exists event_registration_deliveries_provider_message_id_idx
  on public.event_registration_deliveries (provider_message_id, created_at desc)
  where provider_message_id is not null;

alter table public.event_registration_deliveries enable row level security;

revoke all on table public.event_registration_deliveries
  from public, anon, authenticated;
grant select, insert, update on table public.event_registration_deliveries
  to service_role;

drop trigger if exists event_registration_deliveries_set_updated_at
  on public.event_registration_deliveries;
create trigger event_registration_deliveries_set_updated_at
before update on public.event_registration_deliveries
for each row execute function public.set_current_timestamp_updated_at();

create table if not exists public.event_registration_delivery_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  provider_message_id text not null,
  event_registration_delivery_id uuid not null
    references public.event_registration_deliveries(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete restrict,
  registration_code text not null
    references public.event_registrations(registration_code) on delete restrict,
  event_type text not null,
  delivery_status text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint event_registration_delivery_webhook_events_status_check
    check (delivery_status is null or delivery_status in (
      'sent', 'delivered', 'delayed', 'failed', 'bounced', 'complained'
    ))
);

create index if not exists event_registration_delivery_events_registration_idx
  on public.event_registration_delivery_webhook_events (registration_code, occurred_at desc);

create index if not exists event_registration_delivery_events_delivery_idx
  on public.event_registration_delivery_webhook_events (event_registration_delivery_id);

create index if not exists event_registration_delivery_events_event_id_idx
  on public.event_registration_delivery_webhook_events (event_id);

alter table public.event_registration_delivery_webhook_events enable row level security;

revoke all on table public.event_registration_delivery_webhook_events
  from public, anon, authenticated;
grant select, insert, update, delete on table public.event_registration_delivery_webhook_events
  to service_role;

create or replace function public.record_event_registration_delivery_webhook_event(
  p_provider_event_id text,
  p_provider_message_id text,
  p_event_type text,
  p_delivery_status text,
  p_occurred_at timestamptz
)
returns table (
  tracked boolean,
  duplicate boolean,
  applied_status text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_delivery public.event_registration_deliveries%rowtype;
  v_event_id uuid;
  v_next_status text := nullif(btrim(p_delivery_status), '');
  v_applied boolean := false;
begin
  if coalesce(btrim(p_provider_event_id), '') = ''
    or coalesce(btrim(p_provider_message_id), '') = ''
    or coalesce(btrim(p_event_type), '') = ''
    or p_occurred_at is null then
    raise exception 'Invalid Resend delivery webhook event.';
  end if;

  if v_next_status is not null and v_next_status not in (
    'sent', 'delivered', 'delayed', 'failed', 'bounced', 'complained'
  ) then
    raise exception 'Invalid Resend delivery status.';
  end if;

  select *
  into v_delivery
  from public.event_registration_deliveries
  where provider_message_id = p_provider_message_id
  order by created_at desc
  limit 1
  for update;

  if not found then
    return query select false, false, null::text;
    return;
  end if;

  insert into public.event_registration_delivery_webhook_events (
    provider_event_id,
    provider_message_id,
    event_registration_delivery_id,
    event_id,
    registration_code,
    event_type,
    delivery_status,
    occurred_at
  )
  values (
    p_provider_event_id,
    p_provider_message_id,
    v_delivery.id,
    v_delivery.event_id,
    v_delivery.registration_code,
    p_event_type,
    v_next_status,
    p_occurred_at
  )
  on conflict (provider_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return query select true, true, null::text;
    return;
  end if;

  if v_next_status is null then
    return query select true, false, null::text;
    return;
  end if;

  if (
    (v_next_status = 'sent' and v_delivery.status = 'pending')
    or (v_next_status = 'delayed' and v_delivery.status in ('pending', 'sent'))
    or (v_next_status = 'delivered' and v_delivery.status in ('pending', 'sent', 'delayed'))
    or (v_next_status = 'failed' and v_delivery.status in ('pending', 'sent', 'delayed'))
    or (v_next_status = 'bounced' and v_delivery.status in ('pending', 'sent', 'delayed', 'failed'))
    or (v_next_status = 'complained' and v_delivery.status in (
      'pending', 'sent', 'delayed', 'delivered', 'failed', 'bounced'
    ))
  ) then
    update public.event_registration_deliveries
    set
      status = v_next_status,
      last_provider_event_at = greatest(
        coalesce(last_provider_event_at, '-infinity'::timestamptz),
        p_occurred_at
      )
    where id = v_delivery.id;
    v_applied := true;
  end if;

  return query select true, false, case when v_applied then v_next_status else null end;
end;
$$;

revoke all on function public.record_event_registration_delivery_webhook_event(
  text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_event_registration_delivery_webhook_event(
  text, text, text, text, timestamptz
) to service_role;

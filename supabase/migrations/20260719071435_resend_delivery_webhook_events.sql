-- Signed Resend delivery events are stored without raw payloads or recipient PII.
-- This migration is local only until explicitly approved and applied.

alter table public.member_invitations
  drop constraint if exists member_invitations_delivery_status_check,
  add constraint member_invitations_delivery_status_check
    check (delivery_status in (
      'pending',
      'sent',
      'delivered',
      'delayed',
      'failed',
      'bounced',
      'complained',
      'skipped',
      'claimed',
      'revoked',
      'expired'
    ));

alter table public.invitation_email_deliveries
  add column if not exists last_provider_event_at timestamptz,
  drop constraint if exists invitation_email_deliveries_status_check,
  add constraint invitation_email_deliveries_status_check
    check (status in (
      'pending',
      'sent',
      'delivered',
      'delayed',
      'failed',
      'bounced',
      'complained',
      'skipped'
    ));

create table if not exists public.resend_delivery_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  provider_message_id text not null,
  invitation_email_delivery_id uuid not null
    references public.invitation_email_deliveries(id) on delete cascade,
  invitation_id uuid not null
    references public.member_invitations(id) on delete cascade,
  event_type text not null,
  delivery_status text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint resend_delivery_webhook_events_delivery_status_check
    check (delivery_status is null or delivery_status in (
      'sent',
      'delivered',
      'delayed',
      'failed',
      'bounced',
      'complained'
    ))
);

create index if not exists invitation_email_deliveries_provider_message_id_idx
  on public.invitation_email_deliveries (provider_message_id, created_at desc)
  where provider_message_id is not null;

create index if not exists resend_delivery_webhook_events_invitation_idx
  on public.resend_delivery_webhook_events (invitation_id, occurred_at desc);

alter table public.resend_delivery_webhook_events enable row level security;

revoke all on table public.resend_delivery_webhook_events
  from public, anon, authenticated;
grant select, insert, update, delete on table public.resend_delivery_webhook_events
  to service_role;

create or replace function public.record_invitation_delivery_webhook_event(
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
  v_delivery public.invitation_email_deliveries%rowtype;
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
  from public.invitation_email_deliveries
  where provider_message_id = p_provider_message_id
  order by created_at desc
  limit 1
  for update;

  if not found then
    return query select false, false, null::text;
    return;
  end if;

  insert into public.resend_delivery_webhook_events (
    provider_event_id,
    provider_message_id,
    invitation_email_delivery_id,
    invitation_id,
    event_type,
    delivery_status,
    occurred_at
  )
  values (
    p_provider_event_id,
    p_provider_message_id,
    v_delivery.id,
    v_delivery.invitation_id,
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
    update public.invitation_email_deliveries
    set
      status = v_next_status,
      last_provider_event_at = greatest(
        coalesce(last_provider_event_at, '-infinity'::timestamptz),
        p_occurred_at
      )
    where id = v_delivery.id;
    v_applied := true;
  end if;

  if v_applied then
    update public.member_invitations
    set delivery_status = v_next_status
    where id = v_delivery.invitation_id
      and delivery_status not in ('claimed', 'revoked', 'expired', 'skipped')
      and (
        (v_next_status = 'sent' and delivery_status = 'pending')
        or (v_next_status = 'delayed' and delivery_status in ('pending', 'sent'))
        or (v_next_status = 'delivered' and delivery_status in ('pending', 'sent', 'delayed'))
        or (v_next_status = 'failed' and delivery_status in ('pending', 'sent', 'delayed'))
        or (v_next_status = 'bounced' and delivery_status in ('pending', 'sent', 'delayed', 'failed'))
        or (v_next_status = 'complained' and delivery_status in (
          'pending', 'sent', 'delayed', 'delivered', 'failed', 'bounced'
        ))
      );
  end if;

  return query select true, false, case when v_applied then v_next_status else null end;
end;
$$;

revoke all on function public.record_invitation_delivery_webhook_event(
  text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_invitation_delivery_webhook_event(
  text, text, text, text, timestamptz
) to service_role;
create table if not exists public.form_confirmation_deliveries (
  id uuid primary key default gen_random_uuid(),
  form_submission_id uuid not null
    references public.form_submissions(id) on delete restrict,
  idempotency_key text not null unique,
  status text not null,
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  last_provider_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint form_confirmation_deliveries_status_check
    check (status in (
      'pending',
      'sent',
      'delivered',
      'delayed',
      'failed',
      'bounced',
      'complained'
    ))
);

create index if not exists form_confirmation_deliveries_submission_idx
  on public.form_confirmation_deliveries (form_submission_id, created_at desc);

create index if not exists form_confirmation_deliveries_provider_message_id_idx
  on public.form_confirmation_deliveries (provider_message_id, created_at desc)
  where provider_message_id is not null;

alter table public.form_confirmation_deliveries enable row level security;

revoke all on table public.form_confirmation_deliveries
  from public, anon, authenticated;
grant select, insert, update on table public.form_confirmation_deliveries
  to service_role;

drop trigger if exists form_confirmation_deliveries_set_updated_at
  on public.form_confirmation_deliveries;
create trigger form_confirmation_deliveries_set_updated_at
before update on public.form_confirmation_deliveries
for each row execute function public.set_current_timestamp_updated_at();

create table if not exists public.form_confirmation_delivery_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  provider_message_id text not null,
  form_confirmation_delivery_id uuid not null
    references public.form_confirmation_deliveries(id) on delete cascade,
  form_submission_id uuid not null
    references public.form_submissions(id) on delete restrict,
  event_type text not null,
  delivery_status text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint form_confirmation_delivery_webhook_events_status_check
    check (delivery_status is null or delivery_status in (
      'sent',
      'delivered',
      'delayed',
      'failed',
      'bounced',
      'complained'
    ))
);

create index if not exists form_confirmation_delivery_events_submission_idx
  on public.form_confirmation_delivery_webhook_events (form_submission_id, occurred_at desc);

create index if not exists form_confirmation_delivery_events_delivery_idx
  on public.form_confirmation_delivery_webhook_events (form_confirmation_delivery_id);

alter table public.form_confirmation_delivery_webhook_events enable row level security;

revoke all on table public.form_confirmation_delivery_webhook_events
  from public, anon, authenticated;
grant select, insert, update, delete on table public.form_confirmation_delivery_webhook_events
  to service_role;

create or replace function public.record_form_confirmation_delivery_webhook_event(
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
  v_delivery public.form_confirmation_deliveries%rowtype;
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
  from public.form_confirmation_deliveries
  where provider_message_id = p_provider_message_id
  order by created_at desc
  limit 1
  for update;

  if not found then
    return query select false, false, null::text;
    return;
  end if;

  insert into public.form_confirmation_delivery_webhook_events (
    provider_event_id,
    provider_message_id,
    form_confirmation_delivery_id,
    form_submission_id,
    event_type,
    delivery_status,
    occurred_at
  )
  values (
    p_provider_event_id,
    p_provider_message_id,
    v_delivery.id,
    v_delivery.form_submission_id,
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
    update public.form_confirmation_deliveries
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

revoke all on function public.record_form_confirmation_delivery_webhook_event(
  text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_form_confirmation_delivery_webhook_event(
  text, text, text, text, timestamptz
) to service_role;
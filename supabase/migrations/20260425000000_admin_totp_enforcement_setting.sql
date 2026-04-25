create table if not exists public.security_settings (
  id boolean primary key default true check (id),
  admin_totp_enforced boolean not null default true,
  updated_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.security_settings (id, admin_totp_enforced)
values (true, true)
on conflict (id) do nothing;

drop trigger if exists security_settings_set_updated_at on public.security_settings;
create trigger security_settings_set_updated_at
before update on public.security_settings
for each row execute function public.set_current_timestamp_updated_at();

create or replace function public.is_admin_totp_enforced()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select settings.admin_totp_enforced
      from public.security_settings as settings
      where settings.id = true
      limit 1
    ),
    true
  );
$$;

revoke all on function public.is_admin_totp_enforced() from public;
grant execute on function public.is_admin_totp_enforced() to anon, authenticated, service_role;

alter table public.security_settings enable row level security;

drop policy if exists "security settings readable by security admins" on public.security_settings;
create policy "security settings readable by security admins"
on public.security_settings
for select
to authenticated
using (public.has_permission('admin.security.read'));

drop policy if exists "security settings writable by security admins" on public.security_settings;
create policy "security settings writable by security admins"
on public.security_settings
for update
to authenticated
using (public.has_permission('admin.security.write'))
with check (public.has_permission('admin.security.write'));

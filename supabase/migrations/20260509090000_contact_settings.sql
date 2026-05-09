-- Public contact page settings managed from the admin workspace.

create table if not exists public.contact_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text,
  label text not null,
  description text,
  input_type text not null default 'text',
  group_name text not null default 'general',
  sort_order integer not null default 0,
  is_public boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists contact_settings_group_sort_idx
  on public.contact_settings (group_name, sort_order, key);

create index if not exists contact_settings_public_idx
  on public.contact_settings (is_public, group_name, sort_order)
  where is_public = true;

drop trigger if exists contact_settings_set_updated_at on public.contact_settings;
create trigger contact_settings_set_updated_at
before update on public.contact_settings
for each row execute function public.set_current_timestamp_updated_at();

alter table public.contact_settings enable row level security;

drop policy if exists "contact settings public read" on public.contact_settings;
create policy "contact settings public read"
on public.contact_settings
for select
to anon, authenticated
using (is_public = true);

drop policy if exists "contact settings admin read" on public.contact_settings;
create policy "contact settings admin read"
on public.contact_settings
for select
to authenticated
using (public.has_permission('admin.settings.read'));

drop policy if exists "contact settings admin insert" on public.contact_settings;
create policy "contact settings admin insert"
on public.contact_settings
for insert
to authenticated
with check (public.has_permission('admin.settings.write'));

drop policy if exists "contact settings admin update" on public.contact_settings;
create policy "contact settings admin update"
on public.contact_settings
for update
to authenticated
using (public.has_permission('admin.settings.write'))
with check (public.has_permission('admin.settings.write'));

drop policy if exists "contact settings admin delete" on public.contact_settings;
create policy "contact settings admin delete"
on public.contact_settings
for delete
to authenticated
using (public.has_permission('admin.settings.write'));

insert into public.contact_settings (
  key,
  value,
  label,
  description,
  input_type,
  group_name,
  sort_order
)
values
  (
    'email_primary',
    'info@jnuits.org.bd',
    'Primary Email',
    'Main contact email shown on contact page',
    'email',
    'email',
    1
  ),
  (
    'email_university',
    'itsociety@association.jnu.ac.bd',
    'University Email',
    'Official JnU authority email (CC)',
    'email',
    'email',
    2
  ),
  (
    'email_legacy',
    'jnuitsbd@gmail.com',
    'Legacy Email',
    'Old Gmail address (CC/archive)',
    'email',
    'email',
    3
  ),
  (
    'phone_primary',
    '+880 1721-129467',
    'Primary Phone',
    'Main organisational contact number',
    'tel',
    'phone',
    1
  ),
  (
    'phone_secondary',
    '+880 1567-934536',
    'Secondary Phone',
    'Secondary contact number',
    'tel',
    'phone',
    2
  ),
  (
    'address',
    '9, 10 Chittaranjan Ave, Dhaka 1100, Bangladesh',
    'Office Address',
    'Physical address shown on contact page',
    'text',
    'location',
    1
  ),
  (
    'founded_date',
    'November 11, 2015',
    'Founded Date',
    'Founding date displayed publicly',
    'text',
    'location',
    2
  ),
  ('hours_sat', 'Closed', 'Saturday Hours', null, 'text', 'hours', 1),
  ('hours_sun', '8:00 AM – 4:00 PM', 'Sunday Hours', null, 'text', 'hours', 2),
  ('hours_mon', '8:00 AM – 4:00 PM', 'Monday Hours', null, 'text', 'hours', 3),
  ('hours_tue', '8:00 AM – 4:00 PM', 'Tuesday Hours', null, 'text', 'hours', 4),
  ('hours_wed', '8:00 AM – 4:00 PM', 'Wednesday Hours', null, 'text', 'hours', 5),
  ('hours_thu', '8:00 AM – 4:00 PM', 'Thursday Hours', null, 'text', 'hours', 6),
  ('hours_fri', 'Closed', 'Friday Hours', null, 'text', 'hours', 7)
on conflict (key) do update
set
  value = excluded.value,
  label = excluded.label,
  description = excluded.description,
  input_type = excluded.input_type,
  group_name = excluded.group_name,
  sort_order = excluded.sort_order,
  is_public = true;

grant select on public.contact_settings to anon, authenticated;
grant insert, update, delete on public.contact_settings to authenticated;

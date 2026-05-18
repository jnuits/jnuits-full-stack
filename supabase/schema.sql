-- JnUITS Supabase schema snapshot
-- Generated from linked project fsirdkjgrcocowxqjhjg on 2026-05-18T06:29:08.614Z
-- Schema-only snapshot: no table row data is included.
-- Use migrations for change history; use this file for current database structure review.

-- ============================================================================
-- Extensions
-- ============================================================================

create extension if not exists citext with schema extensions;

create extension if not exists pg_stat_statements with schema extensions;

create extension if not exists pgcrypto with schema extensions;

create extension if not exists "uuid-ossp" with schema extensions;

-- ============================================================================
-- Sequences
-- ============================================================================

create sequence if not exists public.advisor_ca_id_seq;

create sequence if not exists public.advisor_mod_id_seq;

create sequence if not exists public.advisor_ra_id_seq;

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists public.admin_profiles (
  id uuid default extensions.gen_random_uuid() not null,
  user_id uuid not null,
  linked_member_id uuid,
  admin_code citext not null,
  display_name text not null,
  email citext,
  title text,
  avatar_public_id text,
  avatar_secure_url text,
  avatar_width integer,
  avatar_height integer,
  avatar_bytes bigint,
  avatar_format text,
  avatar_updated_at timestamp with time zone,
  avatar_updated_by_user_id uuid,
  is_active boolean default true not null,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.advisor_profiles (
  id uuid default extensions.gen_random_uuid() not null,
  user_id uuid,
  advisor_type text default 'honorable_advisor'::text not null,
  full_name text not null,
  title text,
  department text,
  designation text,
  email text,
  phone text,
  avatar_public_id text,
  avatar_secure_url text,
  speech text,
  bio text,
  work_experience jsonb default '[]'::jsonb not null,
  publications jsonb default '[]'::jsonb not null,
  facebook_url text,
  linkedin_url text,
  website_url text,
  joined_on date,
  left_on date,
  is_current boolean default true not null,
  is_public boolean default true not null,
  sort_order integer default 100 not null,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  advisor_jnuits_id text,
  former_title text,
  tenure_display text,
  date_confidence text default 'verified'::text not null,
  status_note text,
  jnu_profile_url text,
  speech_updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.audit_events (
  id uuid default extensions.gen_random_uuid() not null,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.blog_review_events (
  id uuid default extensions.gen_random_uuid() not null,
  post_id uuid not null,
  reviewer_user_id uuid,
  action text not null,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.bulk_operation_rows (
  id uuid default extensions.gen_random_uuid() not null,
  operation_id uuid not null,
  row_number integer not null,
  raw_data jsonb default '{}'::jsonb not null,
  normalized_data jsonb default '{}'::jsonb not null,
  status text default 'pending'::text not null,
  errors jsonb default '[]'::jsonb not null,
  result jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.bulk_operations (
  id uuid default extensions.gen_random_uuid() not null,
  operation_type text not null,
  status text default 'draft'::text not null,
  original_filename text,
  total_rows integer default 0 not null,
  valid_rows integer default 0 not null,
  error_rows integer default 0 not null,
  committed_rows integer default 0 not null,
  metadata jsonb default '{}'::jsonb not null,
  created_by_user_id uuid,
  committed_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  previewed_at timestamp with time zone,
  committed_at timestamp with time zone,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.certificate_import_batches (
  id uuid default extensions.gen_random_uuid() not null,
  source_name text not null,
  source_checksum text,
  source_row_count integer default 0 not null,
  status text default 'pending'::text not null,
  inserted_count integer default 0 not null,
  updated_count integer default 0 not null,
  rejected_count integer default 0 not null,
  report jsonb default '{}'::jsonb not null,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  finished_at timestamp with time zone,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.certificates (
  id uuid default extensions.gen_random_uuid() not null,
  certificate_id citext not null,
  first_name text not null,
  last_name text not null,
  details text default ''::text not null,
  exam_or_event text not null,
  exam_or_event_name text not null,
  issue_date date not null,
  asset_url text,
  source_document_id text,
  source_record_id text,
  source_migrated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.certificates_import_staging (
  id uuid default extensions.gen_random_uuid() not null,
  import_batch_id uuid not null,
  row_number integer not null,
  certificate_id_raw text,
  first_name_raw text,
  last_name_raw text,
  details_raw text,
  exam_or_event_raw text,
  exam_or_event_name_raw text,
  issue_date_raw text,
  asset_url_raw text,
  source_document_id_raw text,
  source_record_id_raw text,
  parse_error text,
  imported_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.committee_assignments (
  id uuid default extensions.gen_random_uuid() not null,
  term_id uuid not null,
  role_id uuid not null,
  member_id uuid,
  display_name text,
  bio text,
  sort_order integer default 100 not null,
  starts_on date,
  ends_on date,
  status text default 'active'::text not null,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  rollover_source_assignment_id uuid,
  public_title_override text,
  is_public boolean default true not null,
  source text default 'admin'::text not null,
  import_batch_id uuid,
  metadata jsonb default '{}'::jsonb not null
);

create table if not exists public.committee_roles (
  id uuid default extensions.gen_random_uuid() not null,
  code text not null,
  title text not null,
  sort_order integer default 100 not null,
  is_executive boolean default false not null,
  is_public boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  title_bn text,
  aliases text[] default '{}'::text[] not null,
  role_group text default 'executive'::text not null,
  min_slots integer default 1 not null,
  max_slots integer default 1 not null,
  default_slots integer default 1 not null
);

create table if not exists public.committee_terms (
  id uuid default extensions.gen_random_uuid() not null,
  slug text not null,
  title text not null,
  summary text,
  starts_on date not null,
  ends_on date,
  status text default 'draft'::text not null,
  is_public boolean default false not null,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  rollover_source_term_id uuid,
  term_number integer,
  term_kind text default 'executive'::text not null,
  election_date date,
  is_current boolean default false not null,
  date_confidence text default 'verified'::text not null,
  tenure_note text,
  target_executive_slots integer default 21 not null,
  voter_rule_note text
);

create table if not exists public.contact_settings (
  id uuid default gen_random_uuid() not null,
  key text not null,
  value text,
  label text not null,
  description text,
  input_type text default 'text'::text not null,
  group_name text default 'general'::text not null,
  sort_order integer default 0 not null,
  is_public boolean default true not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid
);

create table if not exists public.content_pages (
  id uuid default extensions.gen_random_uuid() not null,
  slug text not null,
  title text not null,
  eyebrow text,
  summary text,
  body jsonb default '{}'::jsonb not null,
  status text default 'draft'::text not null,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.content_posts (
  id uuid default extensions.gen_random_uuid() not null,
  content_type text not null,
  slug text not null,
  title text not null,
  category text,
  summary text,
  excerpt text,
  body text,
  status text default 'draft'::text not null,
  published_at timestamp with time zone,
  read_time text,
  location text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  cta_href text,
  media_asset_id uuid,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  author_member_id uuid,
  submitted_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  reviewed_by_user_id uuid,
  review_note text,
  event_capacity integer,
  registration_open boolean default false not null,
  registration_closes_at timestamp with time zone,
  author_advisor_profile_id uuid
);

create table if not exists public.departments (
  code text not null,
  name text not null,
  sort_order integer default 100 not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.developer_profiles (
  id uuid default extensions.gen_random_uuid() not null,
  name text not null,
  role text not null,
  focus text not null,
  bio text not null,
  sort_order integer default 100 not null,
  is_lead boolean default false not null,
  status text default 'draft'::text not null,
  media_asset_id uuid,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.event_registrations (
  id uuid default gen_random_uuid() not null,
  event_post_id uuid,
  member_id uuid,
  registrant_name text not null,
  registrant_email citext not null,
  registrant_phone text,
  registration_code text default upper("left"(replace((gen_random_uuid())::text, '-'::text, ''::text), 8)) not null,
  checked_in_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  event_id uuid
);

create table if not exists public.events (
  id uuid default extensions.gen_random_uuid() not null,
  legacy_content_post_id uuid,
  title text not null,
  slug text not null,
  summary text not null,
  body_markdown text,
  category text not null,
  delivery_mode text not null,
  status text default 'draft'::text not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone,
  timezone text default 'Asia/Dhaka'::text not null,
  location_mode text default 'tba'::text not null,
  location_label text,
  venue_name text,
  venue_address text,
  online_url text,
  registration_mode text default 'none'::text not null,
  registration_url text,
  registration_open boolean default false not null,
  registration_closes_at timestamp with time zone,
  capacity integer,
  cta_label text,
  cta_url text,
  cover_media_asset_id uuid,
  cover_alt_text_override text,
  source text default 'seed'::text not null,
  source_metadata jsonb default '{}'::jsonb not null,
  published_at timestamp with time zone,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.gallery_album_items (
  id uuid default extensions.gen_random_uuid() not null,
  album_id uuid not null,
  media_asset_id uuid not null,
  title text,
  description text,
  alt_text text,
  source_caption text,
  width integer,
  height integer,
  blur_data_url text,
  sort_order integer default 100 not null,
  is_cover boolean default false not null,
  status text default 'published'::text not null,
  source_metadata jsonb default '{}'::jsonb not null,
  deleted_at timestamp with time zone,
  deleted_by_user_id uuid,
  trash_reason text,
  trash_metadata jsonb default '{}'::jsonb not null,
  restorable_until timestamp with time zone,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.gallery_albums (
  id uuid default extensions.gen_random_uuid() not null,
  slug text not null,
  title text not null,
  event_name text,
  description text,
  year integer not null,
  month integer,
  starts_on date,
  ends_on date,
  category text default 'event'::text not null,
  status text default 'published'::text not null,
  featured boolean default false not null,
  cover_item_id uuid,
  cloudinary_folder text,
  source text default 'manual'::text not null,
  source_metadata jsonb default '{}'::jsonb not null,
  deleted_at timestamp with time zone,
  deleted_by_user_id uuid,
  trash_reason text,
  trash_metadata jsonb default '{}'::jsonb not null,
  restorable_until timestamp with time zone,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.gallery_entries (
  id uuid default extensions.gen_random_uuid() not null,
  title text not null,
  caption text,
  sort_order integer default 100 not null,
  status text default 'draft'::text not null,
  media_asset_id uuid not null,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.invitation_batches (
  id uuid default extensions.gen_random_uuid() not null,
  cycle_id uuid,
  label text not null,
  source text default 'manual'::text not null,
  status text default 'draft'::text not null,
  issued_count integer default 0 not null,
  claimed_count integer default 0 not null,
  expires_at timestamp with time zone,
  metadata jsonb default '{}'::jsonb not null,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.invitation_email_deliveries (
  id uuid default gen_random_uuid() not null,
  invitation_id uuid not null,
  channel text default 'email'::text not null,
  recipient_email text not null,
  status text not null,
  provider_message_id text,
  error_message text,
  sent_at timestamp with time zone,
  created_by_user_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.media_assets (
  id uuid default extensions.gen_random_uuid() not null,
  provider text default 'cloudinary'::text not null,
  media_kind text not null,
  title text,
  alt_text text,
  is_public boolean default true not null,
  secure_url text not null,
  thumbnail_url text,
  public_id text not null,
  resource_type text not null,
  format text,
  width integer,
  height integer,
  bytes bigint,
  duration_seconds numeric(10,2),
  metadata jsonb default '{}'::jsonb not null,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  deleted_at timestamp with time zone,
  deleted_by_user_id uuid,
  trash_original_public_id text,
  trash_public_id text,
  trash_moved_at timestamp with time zone,
  trash_restore_deadline timestamp with time zone
);

create table if not exists public.member_invitations (
  id uuid default extensions.gen_random_uuid() not null,
  member_id uuid not null,
  code_hash text not null,
  max_uses integer default 1 not null,
  used_count integer default 0 not null,
  expires_at timestamp with time zone not null,
  is_active boolean default true not null,
  revoked_at timestamp with time zone,
  last_used_at timestamp with time zone,
  notes text,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  batch_id uuid,
  invitation_type text default 'member_claim'::text not null,
  delivery_status text default 'pending'::text not null,
  last_sent_at timestamp with time zone,
  send_attempts integer default 0 not null,
  recipient_email_snapshot text,
  recipient_name_snapshot text,
  revoked_by_user_id uuid,
  revocation_reason text
);

create table if not exists public.members (
  id uuid default extensions.gen_random_uuid() not null,
  jnuits_id citext not null,
  full_name text not null,
  email citext,
  phone text,
  department_code text,
  batch_no integer,
  member_type text default 'current'::text not null,
  alumni_since date,
  current_organization text,
  designation text,
  work_location text,
  linkedin_url text,
  website_url text,
  professional_visibility text default 'members-only'::text not null,
  verification_code_hash text,
  is_profile_claimed boolean default false not null,
  profile_claimed_at timestamp with time zone,
  user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  first_name text,
  last_name text,
  student_id text,
  graduation_year integer,
  lifecycle_status text default 'current'::text not null,
  portal_access_status text default 'active'::text not null,
  lifecycle_changed_at timestamp with time zone,
  lifecycle_changed_by_user_id uuid,
  lifecycle_note text,
  avatar_public_id text,
  avatar_secure_url text,
  avatar_width integer,
  avatar_height integer,
  avatar_bytes bigint,
  avatar_format text,
  avatar_updated_at timestamp with time zone,
  avatar_updated_by_user_id uuid,
  facebook_url text
);

create table if not exists public.membership_applications (
  id uuid default extensions.gen_random_uuid() not null,
  name text not null,
  email citext not null,
  department_code text,
  batch_label text,
  student_id text,
  phone text,
  facebook_url text,
  linkedin_url text,
  photo_url text,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  review_note text,
  reviewed_at timestamp with time zone,
  reviewed_by_user_id uuid,
  processed_member_id uuid,
  invitation_id uuid
);

create table if not exists public.membership_cycle_memberships (
  id uuid default extensions.gen_random_uuid() not null,
  cycle_id uuid not null,
  member_id uuid not null,
  state text default 'active'::text not null,
  enrolled_at timestamp with time zone default timezone('utc'::text, now()) not null,
  renewed_at timestamp with time zone,
  expires_on date,
  note text,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.membership_cycles (
  id uuid default extensions.gen_random_uuid() not null,
  code text not null,
  title text not null,
  starts_on date not null,
  ends_on date,
  renewal_open_on date,
  renewal_close_on date,
  status text default 'draft'::text not null,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.membership_id_sequences (
  year_block text not null,
  last_serial integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.membership_lifecycle_events (
  id uuid default extensions.gen_random_uuid() not null,
  member_id uuid not null,
  event_type text not null,
  occurred_at timestamp with time zone default timezone('utc'::text, now()) not null,
  summary text,
  metadata jsonb default '{}'::jsonb not null,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.mentorship_messages (
  id uuid default extensions.gen_random_uuid() not null,
  relationship_id uuid not null,
  author_user_id uuid not null,
  body_markdown text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.mentorship_profiles (
  user_id uuid not null,
  member_id uuid not null,
  availability_status text default 'open'::text not null,
  bio text default ''::text not null,
  interests text[] default '{}'::text[] not null,
  opt_in boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.mentorship_relationships (
  id uuid default extensions.gen_random_uuid() not null,
  member_user_id uuid not null,
  alumni_user_id uuid not null,
  status text default 'requested'::text not null,
  created_by_user_id uuid not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  closed_at timestamp with time zone
);

create table if not exists public.operator_reports (
  id uuid default extensions.gen_random_uuid() not null,
  report_type text not null,
  title text not null,
  status text default 'completed'::text not null,
  summary text,
  report jsonb default '{}'::jsonb not null,
  created_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.portal_user_settings (
  user_id uuid not null,
  member_id uuid,
  notification_email_opt_in boolean default true not null,
  mentorship_opt_in boolean default false not null,
  ticket_digest_opt_in boolean default true not null,
  preferred_theme text default 'system'::text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.profile_update_requests (
  id uuid default extensions.gen_random_uuid() not null,
  member_id uuid not null,
  request_type text not null,
  payload jsonb default '{}'::jsonb not null,
  status text default 'pending'::text not null,
  requested_at timestamp with time zone default timezone('utc'::text, now()) not null,
  reviewed_at timestamp with time zone,
  review_note text,
  reviewed_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  submitted_by_user_id uuid,
  request_source text default 'portal'::text not null,
  decision_reason text,
  previous_payload_snapshot jsonb default '{}'::jsonb not null,
  applied_payload_snapshot jsonb default '{}'::jsonb not null,
  metadata jsonb default '{}'::jsonb not null
);

create table if not exists public.profiles (
  id uuid not null,
  full_name text,
  email citext,
  phone text,
  department_code text,
  batch_no integer,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.project_contributors (
  id uuid default gen_random_uuid() not null,
  project_id uuid not null,
  member_id uuid not null,
  role text default 'contributor'::text not null,
  joined_at date,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.projects (
  id uuid default gen_random_uuid() not null,
  title text not null,
  slug citext not null,
  tagline text,
  description text default ''::text not null,
  tech_stack text[] default '{}'::text[] not null,
  category text default 'other'::text not null,
  status text default 'active'::text not null,
  cover_image_url text,
  github_url text,
  demo_url text,
  is_featured boolean default false not null,
  started_at date,
  completed_at date,
  created_by_user_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.rbac_permissions (
  code text not null,
  scope text not null,
  description text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.rbac_platform_roles (
  id uuid default extensions.gen_random_uuid() not null,
  code text not null,
  title text not null,
  is_system boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  scope text not null,
  rank integer default 100 not null,
  is_hidden boolean default false not null,
  is_assignable boolean default true not null,
  display_name text not null
);

create table if not exists public.rbac_role_permissions (
  role_id uuid not null,
  permission_code text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.rbac_user_claim_versions (
  user_id uuid not null,
  version bigint default 1 not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.rbac_user_platform_roles (
  id uuid default extensions.gen_random_uuid() not null,
  user_id uuid not null,
  role_id uuid not null,
  granted_by uuid,
  granted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  revoked_at timestamp with time zone,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  scope text not null
);

create table if not exists public.security_events (
  id uuid default extensions.gen_random_uuid() not null,
  actor_user_id uuid,
  target_user_id uuid,
  event_type text not null,
  severity text default 'info'::text not null,
  payload jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.security_settings (
  id boolean default true not null,
  admin_totp_enforced boolean default true not null,
  updated_by_user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.support_ticket_events (
  id uuid default extensions.gen_random_uuid() not null,
  ticket_id uuid not null,
  actor_user_id uuid,
  event_type text not null,
  payload jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.support_ticket_messages (
  id uuid default extensions.gen_random_uuid() not null,
  ticket_id uuid not null,
  author_user_id uuid not null,
  body_markdown text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.support_tickets (
  id uuid default extensions.gen_random_uuid() not null,
  opened_by_user_id uuid not null,
  member_id uuid,
  audience_scope text not null,
  category text not null,
  status text default 'open'::text not null,
  priority text default 'normal'::text not null,
  assigned_to_user_id uuid,
  assigned_role_scope text,
  escalated_to_admin boolean default false not null,
  subject text not null,
  summary text not null,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================================
-- Constraints
-- ============================================================================

alter table only public.admin_profiles add constraint admin_profiles_admin_code_key UNIQUE (admin_code);

alter table only public.admin_profiles add constraint admin_profiles_avatar_bytes_check CHECK (((avatar_bytes IS NULL) OR (avatar_bytes >= 0)));

alter table only public.admin_profiles add constraint admin_profiles_avatar_dimensions_check CHECK ((((avatar_width IS NULL) AND (avatar_height IS NULL)) OR ((avatar_width = 400) AND (avatar_height = 400))));

alter table only public.admin_profiles add constraint admin_profiles_avatar_updated_by_user_id_fkey FOREIGN KEY (avatar_updated_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.admin_profiles add constraint admin_profiles_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.admin_profiles add constraint admin_profiles_linked_member_id_fkey FOREIGN KEY (linked_member_id) REFERENCES members(id) ON DELETE SET NULL;

alter table only public.admin_profiles add constraint admin_profiles_linked_member_id_key UNIQUE (linked_member_id);

alter table only public.admin_profiles add constraint admin_profiles_pkey PRIMARY KEY (id);

alter table only public.admin_profiles add constraint admin_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.admin_profiles add constraint admin_profiles_user_id_key UNIQUE (user_id);

alter table only public.advisor_profiles add constraint advisor_profiles_advisor_id_type_check CHECK (((advisor_jnuits_id IS NULL) OR (((advisor_type = 'main_advisor'::text) AND (advisor_jnuits_id ~ '^JNUITS-CA[0-9]{4}$'::text)) OR ((advisor_type = 'moderator_mentor'::text) AND (advisor_jnuits_id ~ '^JNUITS-MOD[0-9]{4}$'::text)) OR ((advisor_type = 'honorable_advisor'::text) AND (advisor_jnuits_id ~ '^JNUITS-RA[0-9]{4}$'::text)))));

alter table only public.advisor_profiles add constraint advisor_profiles_advisor_jnuits_id_format_check CHECK (((advisor_jnuits_id IS NULL) OR ((advisor_jnuits_id = upper(advisor_jnuits_id)) AND (advisor_jnuits_id ~ '^JNUITS-(CA|MOD|RA)[0-9]{4}$'::text))));

alter table only public.advisor_profiles add constraint advisor_profiles_advisor_jnuits_id_key UNIQUE (advisor_jnuits_id);

alter table only public.advisor_profiles add constraint advisor_profiles_check CHECK (((left_on IS NULL) OR (joined_on IS NULL) OR (left_on >= joined_on)));

alter table only public.advisor_profiles add constraint advisor_profiles_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.advisor_profiles add constraint advisor_profiles_date_confidence_check CHECK ((date_confidence = ANY (ARRAY['verified'::text, 'estimated'::text])));

alter table only public.advisor_profiles add constraint advisor_profiles_pkey PRIMARY KEY (id);

alter table only public.advisor_profiles add constraint advisor_profiles_type_check CHECK ((advisor_type = ANY (ARRAY['main_advisor'::text, 'moderator_mentor'::text, 'honorable_advisor'::text])));

alter table only public.advisor_profiles add constraint advisor_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.advisor_profiles add constraint advisor_profiles_user_id_key UNIQUE (user_id);

alter table only public.audit_events add constraint audit_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.audit_events add constraint audit_events_pkey PRIMARY KEY (id);

alter table only public.blog_review_events add constraint blog_review_events_pkey PRIMARY KEY (id);

alter table only public.blog_review_events add constraint blog_review_events_post_id_fkey FOREIGN KEY (post_id) REFERENCES content_posts(id) ON DELETE CASCADE;

alter table only public.blog_review_events add constraint blog_review_events_reviewer_user_id_fkey FOREIGN KEY (reviewer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.bulk_operation_rows add constraint bulk_operation_rows_operation_id_fkey FOREIGN KEY (operation_id) REFERENCES bulk_operations(id) ON DELETE CASCADE;

alter table only public.bulk_operation_rows add constraint bulk_operation_rows_operation_row_unique UNIQUE (operation_id, row_number);

alter table only public.bulk_operation_rows add constraint bulk_operation_rows_pkey PRIMARY KEY (id);

alter table only public.bulk_operation_rows add constraint bulk_operation_rows_row_number_check CHECK ((row_number > 0));

alter table only public.bulk_operation_rows add constraint bulk_operation_rows_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'valid'::text, 'error'::text, 'committed'::text, 'skipped'::text])));

alter table only public.bulk_operations add constraint bulk_operations_committed_by_user_id_fkey FOREIGN KEY (committed_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.bulk_operations add constraint bulk_operations_counts_check CHECK (((total_rows >= 0) AND (valid_rows >= 0) AND (error_rows >= 0) AND (committed_rows >= 0)));

alter table only public.bulk_operations add constraint bulk_operations_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.bulk_operations add constraint bulk_operations_operation_type_check CHECK ((operation_type = ANY (ARRAY['legacy_member_import'::text, 'member_invite'::text, 'alumni_invite'::text, 'lifecycle_update'::text, 'role_update'::text, 'alumni_conversion'::text, 'account_deletion_review'::text])));

alter table only public.bulk_operations add constraint bulk_operations_pkey PRIMARY KEY (id);

alter table only public.bulk_operations add constraint bulk_operations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'previewed'::text, 'committing'::text, 'committed'::text, 'failed'::text, 'cancelled'::text])));

alter table only public.certificate_import_batches add constraint certificate_import_batches_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.certificate_import_batches add constraint certificate_import_batches_pkey PRIMARY KEY (id);

alter table only public.certificate_import_batches add constraint certificate_import_batches_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text])));

alter table only public.certificates add constraint certificates_certificate_id_key UNIQUE (certificate_id);

alter table only public.certificates_import_staging add constraint certificates_import_staging_import_batch_id_fkey FOREIGN KEY (import_batch_id) REFERENCES certificate_import_batches(id) ON DELETE CASCADE;

alter table only public.certificates_import_staging add constraint certificates_import_staging_pkey PRIMARY KEY (id);

alter table only public.certificates add constraint certificates_pkey PRIMARY KEY (id);

alter table only public.committee_assignments add constraint committee_assignments_check CHECK (((ends_on IS NULL) OR (starts_on IS NULL) OR (ends_on >= starts_on)));

alter table only public.committee_assignments add constraint committee_assignments_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.committee_assignments add constraint committee_assignments_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL;

alter table only public.committee_assignments add constraint committee_assignments_pkey PRIMARY KEY (id);

alter table only public.committee_assignments add constraint committee_assignments_role_id_fkey FOREIGN KEY (role_id) REFERENCES committee_roles(id) ON DELETE RESTRICT;

alter table only public.committee_assignments add constraint committee_assignments_rollover_source_assignment_id_fkey FOREIGN KEY (rollover_source_assignment_id) REFERENCES committee_assignments(id) ON DELETE SET NULL;

alter table only public.committee_assignments add constraint committee_assignments_source_check CHECK ((source = ANY (ARRAY['admin'::text, 'legacy_import'::text, 'bulk_import'::text, 'rollover'::text, 'system'::text])));

alter table only public.committee_assignments add constraint committee_assignments_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'active'::text, 'completed'::text])));

alter table only public.committee_assignments add constraint committee_assignments_term_id_fkey FOREIGN KEY (term_id) REFERENCES committee_terms(id) ON DELETE CASCADE;

alter table only public.committee_roles add constraint committee_roles_code_key UNIQUE (code);

alter table only public.committee_roles add constraint committee_roles_pkey PRIMARY KEY (id);

alter table only public.committee_roles add constraint committee_roles_role_group_check CHECK ((role_group = ANY (ARRAY['executive'::text, 'advisor'::text, 'sub_executive'::text])));

alter table only public.committee_roles add constraint committee_roles_slot_range_check CHECK (((min_slots >= 0) AND (max_slots >= min_slots) AND ((default_slots >= min_slots) AND (default_slots <= max_slots))));

alter table only public.committee_terms add constraint committee_terms_check CHECK (((ends_on IS NULL) OR (ends_on >= starts_on)));

alter table only public.committee_terms add constraint committee_terms_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.committee_terms add constraint committee_terms_date_confidence_check CHECK ((date_confidence = ANY (ARRAY['verified'::text, 'estimated'::text])));

alter table only public.committee_terms add constraint committee_terms_pkey PRIMARY KEY (id);

alter table only public.committee_terms add constraint committee_terms_rollover_source_term_id_fkey FOREIGN KEY (rollover_source_term_id) REFERENCES committee_terms(id) ON DELETE SET NULL;

alter table only public.committee_terms add constraint committee_terms_slug_key UNIQUE (slug);

alter table only public.committee_terms add constraint committee_terms_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'upcoming'::text, 'active'::text, 'archived'::text])));

alter table only public.committee_terms add constraint committee_terms_target_executive_slots_check CHECK (((target_executive_slots >= 1) AND (target_executive_slots <= 60)));

alter table only public.committee_terms add constraint committee_terms_term_kind_check CHECK ((term_kind = ANY (ARRAY['executive'::text, 'advisor_board'::text])));

alter table only public.contact_settings add constraint contact_settings_key_key UNIQUE (key);

alter table only public.contact_settings add constraint contact_settings_pkey PRIMARY KEY (id);

alter table only public.contact_settings add constraint contact_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.content_pages add constraint content_pages_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.content_pages add constraint content_pages_pkey PRIMARY KEY (id);

alter table only public.content_pages add constraint content_pages_slug_check CHECK ((slug = ANY (ARRAY['home'::text, 'about'::text, 'contact'::text, 'footer'::text])));

alter table only public.content_pages add constraint content_pages_slug_key UNIQUE (slug);

alter table only public.content_pages add constraint content_pages_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])));

alter table only public.content_posts add constraint content_posts_author_advisor_profile_id_fkey FOREIGN KEY (author_advisor_profile_id) REFERENCES advisor_profiles(id) ON DELETE SET NULL;

alter table only public.content_posts add constraint content_posts_author_member_id_fkey FOREIGN KEY (author_member_id) REFERENCES members(id) ON DELETE SET NULL;

alter table only public.content_posts add constraint content_posts_check CHECK (((ends_at IS NULL) OR (starts_at IS NULL) OR (ends_at >= starts_at)));

alter table only public.content_posts add constraint content_posts_content_type_check CHECK ((content_type = ANY (ARRAY['blog'::text, 'notice'::text, 'event'::text])));

alter table only public.content_posts add constraint content_posts_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.content_posts add constraint content_posts_media_asset_id_fkey FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;

alter table only public.content_posts add constraint content_posts_pkey PRIMARY KEY (id);

alter table only public.content_posts add constraint content_posts_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.content_posts add constraint content_posts_single_blog_author_check CHECK (((content_type <> 'blog'::text) OR (num_nonnulls(author_member_id, author_advisor_profile_id) <= 1)));

alter table only public.content_posts add constraint content_posts_slug_key UNIQUE (slug);

alter table only public.content_posts add constraint content_posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'change_requested'::text, 'published'::text, 'archived'::text])));

alter table only public.departments add constraint departments_pkey PRIMARY KEY (code);

alter table only public.developer_profiles add constraint developer_profiles_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.developer_profiles add constraint developer_profiles_media_asset_id_fkey FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;

alter table only public.developer_profiles add constraint developer_profiles_pkey PRIMARY KEY (id);

alter table only public.developer_profiles add constraint developer_profiles_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])));

alter table only public.event_registrations add constraint event_registrations_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;

alter table only public.event_registrations add constraint event_registrations_event_post_id_fkey FOREIGN KEY (event_post_id) REFERENCES content_posts(id) ON DELETE CASCADE;

alter table only public.event_registrations add constraint event_registrations_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL;

alter table only public.event_registrations add constraint event_registrations_pkey PRIMARY KEY (id);

alter table only public.event_registrations add constraint event_registrations_registration_code_key UNIQUE (registration_code);

alter table only public.events add constraint events_capacity_check CHECK (((capacity IS NULL) OR (capacity > 0)));

alter table only public.events add constraint events_category_check CHECK ((category = ANY (ARRAY['workshop-training'::text, 'competition'::text, 'member-outreach'::text, 'ceremony-community'::text, 'community-social'::text, 'institutional'::text, 'tour'::text, 'other-real-event'::text])));

alter table only public.events add constraint events_check CHECK (((ends_at IS NULL) OR (ends_at >= starts_at)));

alter table only public.events add constraint events_check1 CHECK (((registration_mode <> 'external'::text) OR (registration_url IS NOT NULL)));

alter table only public.events add constraint events_cover_media_asset_id_fkey FOREIGN KEY (cover_media_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;

alter table only public.events add constraint events_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.events add constraint events_delivery_mode_check CHECK ((delivery_mode = ANY (ARRAY['offline'::text, 'online-or-hybrid'::text, 'unknown'::text])));

alter table only public.events add constraint events_legacy_content_post_id_fkey FOREIGN KEY (legacy_content_post_id) REFERENCES content_posts(id) ON DELETE SET NULL;

alter table only public.events add constraint events_legacy_content_post_id_key UNIQUE (legacy_content_post_id);

alter table only public.events add constraint events_location_mode_check CHECK ((location_mode = ANY (ARRAY['venue'::text, 'online'::text, 'hybrid'::text, 'tba'::text])));

alter table only public.events add constraint events_pkey PRIMARY KEY (id);

alter table only public.events add constraint events_registration_mode_check CHECK ((registration_mode = ANY (ARRAY['internal'::text, 'external'::text, 'none'::text])));

alter table only public.events add constraint events_slug_check CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text));

alter table only public.events add constraint events_slug_key UNIQUE (slug);

alter table only public.events add constraint events_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])));

alter table only public.gallery_album_items add constraint gallery_album_items_album_id_fkey FOREIGN KEY (album_id) REFERENCES gallery_albums(id) ON DELETE CASCADE;

alter table only public.gallery_album_items add constraint gallery_album_items_album_id_media_asset_id_key UNIQUE (album_id, media_asset_id);

alter table only public.gallery_album_items add constraint gallery_album_items_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.gallery_album_items add constraint gallery_album_items_deleted_by_user_id_fkey FOREIGN KEY (deleted_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.gallery_album_items add constraint gallery_album_items_height_check CHECK (((height IS NULL) OR (height > 0)));

alter table only public.gallery_album_items add constraint gallery_album_items_media_asset_id_fkey FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT;

alter table only public.gallery_album_items add constraint gallery_album_items_pkey PRIMARY KEY (id);

alter table only public.gallery_album_items add constraint gallery_album_items_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])));

alter table only public.gallery_album_items add constraint gallery_album_items_width_check CHECK (((width IS NULL) OR (width > 0)));

alter table only public.gallery_albums add constraint gallery_albums_check CHECK (((ends_on IS NULL) OR (starts_on IS NULL) OR (ends_on >= starts_on)));

alter table only public.gallery_albums add constraint gallery_albums_cover_item_id_fkey FOREIGN KEY (cover_item_id) REFERENCES gallery_album_items(id) ON DELETE SET NULL;

alter table only public.gallery_albums add constraint gallery_albums_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.gallery_albums add constraint gallery_albums_deleted_by_user_id_fkey FOREIGN KEY (deleted_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.gallery_albums add constraint gallery_albums_month_check CHECK (((month >= 1) AND (month <= 12)));

alter table only public.gallery_albums add constraint gallery_albums_pkey PRIMARY KEY (id);

alter table only public.gallery_albums add constraint gallery_albums_slug_check CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text));

alter table only public.gallery_albums add constraint gallery_albums_slug_key UNIQUE (slug);

alter table only public.gallery_albums add constraint gallery_albums_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])));

alter table only public.gallery_albums add constraint gallery_albums_year_check CHECK (((year >= 2015) AND (year <= 2100)));

alter table only public.gallery_entries add constraint gallery_entries_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.gallery_entries add constraint gallery_entries_media_asset_id_fkey FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT;

alter table only public.gallery_entries add constraint gallery_entries_pkey PRIMARY KEY (id);

alter table only public.gallery_entries add constraint gallery_entries_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])));

alter table only public.invitation_batches add constraint invitation_batches_claimed_count_check CHECK ((claimed_count >= 0));

alter table only public.invitation_batches add constraint invitation_batches_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.invitation_batches add constraint invitation_batches_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES membership_cycles(id) ON DELETE SET NULL;

alter table only public.invitation_batches add constraint invitation_batches_issued_count_check CHECK ((issued_count >= 0));

alter table only public.invitation_batches add constraint invitation_batches_pkey PRIMARY KEY (id);

alter table only public.invitation_batches add constraint invitation_batches_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'csv_onboarding'::text, 'reconciliation'::text, 'renewal'::text])));

alter table only public.invitation_batches add constraint invitation_batches_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'closed'::text, 'archived'::text])));

alter table only public.invitation_email_deliveries add constraint invitation_email_deliveries_channel_check CHECK ((channel = 'email'::text));

alter table only public.invitation_email_deliveries add constraint invitation_email_deliveries_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.invitation_email_deliveries add constraint invitation_email_deliveries_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES member_invitations(id) ON DELETE CASCADE;

alter table only public.invitation_email_deliveries add constraint invitation_email_deliveries_pkey PRIMARY KEY (id);

alter table only public.invitation_email_deliveries add constraint invitation_email_deliveries_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])));

alter table only public.media_assets add constraint media_assets_bytes_check CHECK (((bytes IS NULL) OR (bytes >= 0)));

alter table only public.media_assets add constraint media_assets_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.media_assets add constraint media_assets_deleted_by_user_id_fkey FOREIGN KEY (deleted_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.media_assets add constraint media_assets_duration_seconds_check CHECK (((duration_seconds IS NULL) OR (duration_seconds >= (0)::numeric)));

alter table only public.media_assets add constraint media_assets_height_check CHECK (((height IS NULL) OR (height > 0)));

alter table only public.media_assets add constraint media_assets_media_kind_check CHECK ((media_kind = ANY (ARRAY['image'::text, 'video'::text])));

alter table only public.media_assets add constraint media_assets_pkey PRIMARY KEY (id);

alter table only public.media_assets add constraint media_assets_provider_check CHECK ((provider = 'cloudinary'::text));

alter table only public.media_assets add constraint media_assets_public_id_key UNIQUE (public_id);

alter table only public.media_assets add constraint media_assets_width_check CHECK (((width IS NULL) OR (width > 0)));

alter table only public.member_invitations add constraint member_invitations_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES invitation_batches(id) ON DELETE SET NULL;

alter table only public.member_invitations add constraint member_invitations_code_hash_key UNIQUE (code_hash);

alter table only public.member_invitations add constraint member_invitations_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.member_invitations add constraint member_invitations_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text, 'claimed'::text, 'revoked'::text, 'expired'::text])));

alter table only public.member_invitations add constraint member_invitations_invitation_type_check CHECK ((invitation_type = ANY (ARRAY['member_claim'::text, 'alumni_direct'::text, 'renewal'::text, 'replacement'::text, 'manual'::text, 'bulk_csv'::text])));

alter table only public.member_invitations add constraint member_invitations_max_uses_check CHECK ((max_uses > 0));

alter table only public.member_invitations add constraint member_invitations_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

alter table only public.member_invitations add constraint member_invitations_pkey PRIMARY KEY (id);

alter table only public.member_invitations add constraint member_invitations_revoked_by_user_id_fkey FOREIGN KEY (revoked_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.member_invitations add constraint member_invitations_send_attempts_check CHECK ((send_attempts >= 0));

alter table only public.member_invitations add constraint member_invitations_used_count_check CHECK ((used_count >= 0));

alter table only public.members add constraint members_avatar_bytes_check CHECK (((avatar_bytes IS NULL) OR (avatar_bytes >= 0)));

alter table only public.members add constraint members_avatar_dimensions_check CHECK ((((avatar_width IS NULL) AND (avatar_height IS NULL)) OR ((avatar_width = 400) AND (avatar_height = 400))));

alter table only public.members add constraint members_avatar_updated_by_user_id_fkey FOREIGN KEY (avatar_updated_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.members add constraint members_batch_no_check CHECK (((batch_no IS NULL) OR (batch_no > 0)));

alter table only public.members add constraint members_department_code_fkey FOREIGN KEY (department_code) REFERENCES departments(code) ON DELETE SET NULL;

alter table only public.members add constraint members_graduation_year_check CHECK (((graduation_year IS NULL) OR ((graduation_year >= 1950) AND (graduation_year <= 2100))));

alter table only public.members add constraint members_jnuits_id_key UNIQUE (jnuits_id);

alter table only public.members add constraint members_lifecycle_changed_by_user_id_fkey FOREIGN KEY (lifecycle_changed_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.members add constraint members_lifecycle_status_check CHECK ((lifecycle_status = ANY (ARRAY['current'::text, 'former'::text, 'alumni'::text, 'deleted'::text])));

alter table only public.members add constraint members_member_type_check CHECK ((member_type = ANY (ARRAY['current'::text, 'alumni'::text])));

alter table only public.members add constraint members_pkey PRIMARY KEY (id);

alter table only public.members add constraint members_portal_access_status_check CHECK ((portal_access_status = ANY (ARRAY['active'::text, 'frozen'::text, 'suspended'::text, 'deletion_requested'::text, 'deactivated'::text])));

alter table only public.members add constraint members_professional_visibility_check CHECK ((professional_visibility = ANY (ARRAY['public'::text, 'members-only'::text, 'private'::text])));

alter table only public.members add constraint members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.members add constraint members_user_id_key UNIQUE (user_id);

alter table only public.membership_applications add constraint membership_applications_department_code_fkey FOREIGN KEY (department_code) REFERENCES departments(code) ON DELETE SET NULL;

alter table only public.membership_applications add constraint membership_applications_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES member_invitations(id) ON DELETE SET NULL;

alter table only public.membership_applications add constraint membership_applications_pkey PRIMARY KEY (id);

alter table only public.membership_applications add constraint membership_applications_processed_member_id_fkey FOREIGN KEY (processed_member_id) REFERENCES members(id) ON DELETE SET NULL;

alter table only public.membership_applications add constraint membership_applications_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.membership_applications add constraint membership_applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));

alter table only public.membership_cycle_memberships add constraint membership_cycle_memberships_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.membership_cycle_memberships add constraint membership_cycle_memberships_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES membership_cycles(id) ON DELETE CASCADE;

alter table only public.membership_cycle_memberships add constraint membership_cycle_memberships_cycle_id_member_id_key UNIQUE (cycle_id, member_id);

alter table only public.membership_cycle_memberships add constraint membership_cycle_memberships_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

alter table only public.membership_cycle_memberships add constraint membership_cycle_memberships_pkey PRIMARY KEY (id);

alter table only public.membership_cycle_memberships add constraint membership_cycle_memberships_state_check CHECK ((state = ANY (ARRAY['active'::text, 'pending_renewal'::text, 'renewed'::text, 'expired'::text, 'lapsed'::text])));

alter table only public.membership_cycles add constraint membership_cycles_check CHECK (((ends_on IS NULL) OR (ends_on >= starts_on)));

alter table only public.membership_cycles add constraint membership_cycles_check1 CHECK (((renewal_open_on IS NULL) OR (renewal_open_on >= starts_on)));

alter table only public.membership_cycles add constraint membership_cycles_check2 CHECK (((renewal_close_on IS NULL) OR (renewal_open_on IS NULL) OR (renewal_close_on >= renewal_open_on)));

alter table only public.membership_cycles add constraint membership_cycles_code_key UNIQUE (code);

alter table only public.membership_cycles add constraint membership_cycles_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.membership_cycles add constraint membership_cycles_pkey PRIMARY KEY (id);

alter table only public.membership_cycles add constraint membership_cycles_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'closed'::text, 'archived'::text])));

alter table only public.membership_id_sequences add constraint membership_id_sequences_last_serial_check CHECK (((last_serial >= 0) AND (last_serial <= 999)));

alter table only public.membership_id_sequences add constraint membership_id_sequences_pkey PRIMARY KEY (year_block);

alter table only public.membership_id_sequences add constraint membership_id_sequences_year_block_check CHECK ((year_block ~ '^[0-9]{4}$'::text));

alter table only public.membership_lifecycle_events add constraint membership_lifecycle_events_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.membership_lifecycle_events add constraint membership_lifecycle_events_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

alter table only public.membership_lifecycle_events add constraint membership_lifecycle_events_pkey PRIMARY KEY (id);

alter table only public.mentorship_messages add constraint mentorship_messages_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.mentorship_messages add constraint mentorship_messages_pkey PRIMARY KEY (id);

alter table only public.mentorship_messages add constraint mentorship_messages_relationship_id_fkey FOREIGN KEY (relationship_id) REFERENCES mentorship_relationships(id) ON DELETE CASCADE;

alter table only public.mentorship_profiles add constraint mentorship_profiles_availability_status_check CHECK ((availability_status = ANY (ARRAY['open'::text, 'limited'::text, 'paused'::text])));

alter table only public.mentorship_profiles add constraint mentorship_profiles_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

alter table only public.mentorship_profiles add constraint mentorship_profiles_member_id_key UNIQUE (member_id);

alter table only public.mentorship_profiles add constraint mentorship_profiles_pkey PRIMARY KEY (user_id);

alter table only public.mentorship_profiles add constraint mentorship_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.mentorship_relationships add constraint mentorship_relationships_alumni_user_id_fkey FOREIGN KEY (alumni_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.mentorship_relationships add constraint mentorship_relationships_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.mentorship_relationships add constraint mentorship_relationships_member_user_id_fkey FOREIGN KEY (member_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.mentorship_relationships add constraint mentorship_relationships_pkey PRIMARY KEY (id);

alter table only public.mentorship_relationships add constraint mentorship_relationships_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'active'::text, 'declined'::text, 'closed'::text])));

alter table only public.operator_reports add constraint operator_reports_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.operator_reports add constraint operator_reports_pkey PRIMARY KEY (id);

alter table only public.operator_reports add constraint operator_reports_report_type_check CHECK ((report_type = ANY (ARRAY['membership_overview'::text, 'committee_roster'::text, 'content_inventory'::text, 'reconciliation_snapshot'::text, 'workplace_moderation'::text, 'csv_onboarding'::text, 'membership_reconciliation'::text, 'committee_rollover'::text])));

alter table only public.operator_reports add constraint operator_reports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text])));

alter table only public.portal_user_settings add constraint portal_user_settings_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL;

alter table only public.portal_user_settings add constraint portal_user_settings_pkey PRIMARY KEY (user_id);

alter table only public.portal_user_settings add constraint portal_user_settings_preferred_theme_check CHECK ((preferred_theme = ANY (ARRAY['system'::text, 'light'::text, 'dark'::text])));

alter table only public.portal_user_settings add constraint portal_user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.profile_update_requests add constraint profile_update_requests_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

alter table only public.profile_update_requests add constraint profile_update_requests_pkey PRIMARY KEY (id);

alter table only public.profile_update_requests add constraint profile_update_requests_request_source_check CHECK ((request_source = ANY (ARRAY['portal'::text, 'admin'::text, 'bulk'::text, 'system'::text])));

alter table only public.profile_update_requests add constraint profile_update_requests_request_type_check CHECK ((request_type = ANY (ARRAY['workplace_update'::text, 'profile_change'::text, 'email_change'::text, 'jnuits_id_change'::text, 'alumni_conversion'::text, 'account_deletion'::text])));

alter table only public.profile_update_requests add constraint profile_update_requests_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.profile_update_requests add constraint profile_update_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])));

alter table only public.profile_update_requests add constraint profile_update_requests_submitted_by_user_id_fkey FOREIGN KEY (submitted_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.profiles add constraint profiles_batch_no_check CHECK (((batch_no IS NULL) OR (batch_no > 0)));

alter table only public.profiles add constraint profiles_department_code_fkey FOREIGN KEY (department_code) REFERENCES departments(code) ON DELETE SET NULL;

alter table only public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.profiles add constraint profiles_pkey PRIMARY KEY (id);

alter table only public.profiles add constraint profiles_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'pending'::text])));

alter table only public.project_contributors add constraint project_contributors_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

alter table only public.project_contributors add constraint project_contributors_pkey PRIMARY KEY (id);

alter table only public.project_contributors add constraint project_contributors_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

alter table only public.project_contributors add constraint project_contributors_project_id_member_id_key UNIQUE (project_id, member_id);

alter table only public.projects add constraint projects_category_check CHECK ((category = ANY (ARRAY['web'::text, 'mobile'::text, 'ai'::text, 'systems'::text, 'design'::text, 'other'::text])));

alter table only public.projects add constraint projects_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.projects add constraint projects_pkey PRIMARY KEY (id);

alter table only public.projects add constraint projects_slug_key UNIQUE (slug);

alter table only public.projects add constraint projects_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'archived'::text])));

alter table only public.rbac_permissions add constraint rbac_permissions_pkey PRIMARY KEY (code);

alter table only public.rbac_permissions add constraint rbac_permissions_scope_check CHECK ((scope = ANY (ARRAY['admin'::text, 'portal'::text])));

alter table only public.rbac_platform_roles add constraint rbac_platform_roles_code_key UNIQUE (code);

alter table only public.rbac_platform_roles add constraint rbac_platform_roles_pkey PRIMARY KEY (id);

alter table only public.rbac_platform_roles add constraint rbac_platform_roles_scope_check CHECK ((scope = ANY (ARRAY['admin'::text, 'portal'::text])));

alter table only public.rbac_role_permissions add constraint rbac_role_permissions_permission_code_fkey FOREIGN KEY (permission_code) REFERENCES rbac_permissions(code) ON DELETE CASCADE;

alter table only public.rbac_role_permissions add constraint rbac_role_permissions_pkey PRIMARY KEY (role_id, permission_code);

alter table only public.rbac_role_permissions add constraint rbac_role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES rbac_platform_roles(id) ON DELETE CASCADE;

alter table only public.rbac_user_claim_versions add constraint rbac_user_claim_versions_pkey PRIMARY KEY (user_id);

alter table only public.rbac_user_claim_versions add constraint rbac_user_claim_versions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.rbac_user_platform_roles add constraint rbac_user_platform_roles_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.rbac_user_platform_roles add constraint rbac_user_platform_roles_pkey PRIMARY KEY (id);

alter table only public.rbac_user_platform_roles add constraint rbac_user_platform_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES rbac_platform_roles(id) ON DELETE CASCADE;

alter table only public.rbac_user_platform_roles add constraint rbac_user_platform_roles_scope_check CHECK ((scope = ANY (ARRAY['admin'::text, 'portal'::text])));

alter table only public.rbac_user_platform_roles add constraint rbac_user_platform_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.security_events add constraint security_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.security_events add constraint security_events_pkey PRIMARY KEY (id);

alter table only public.security_events add constraint security_events_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])));

alter table only public.security_events add constraint security_events_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.security_settings add constraint security_settings_id_check CHECK (id);

alter table only public.security_settings add constraint security_settings_pkey PRIMARY KEY (id);

alter table only public.security_settings add constraint security_settings_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.support_ticket_events add constraint support_ticket_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.support_ticket_events add constraint support_ticket_events_pkey PRIMARY KEY (id);

alter table only public.support_ticket_events add constraint support_ticket_events_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE;

alter table only public.support_ticket_messages add constraint support_ticket_messages_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.support_ticket_messages add constraint support_ticket_messages_pkey PRIMARY KEY (id);

alter table only public.support_ticket_messages add constraint support_ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE;

alter table only public.support_tickets add constraint support_tickets_assigned_role_scope_check CHECK ((assigned_role_scope = ANY (ARRAY['member'::text, 'alumni'::text, 'admin'::text])));

alter table only public.support_tickets add constraint support_tickets_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.support_tickets add constraint support_tickets_audience_scope_check CHECK ((audience_scope = ANY (ARRAY['member'::text, 'alumni'::text])));

alter table only public.support_tickets add constraint support_tickets_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL;

alter table only public.support_tickets add constraint support_tickets_opened_by_user_id_fkey FOREIGN KEY (opened_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.support_tickets add constraint support_tickets_pkey PRIMARY KEY (id);

alter table only public.support_tickets add constraint support_tickets_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])));

alter table only public.support_tickets add constraint support_tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'waiting_on_member'::text, 'resolved'::text, 'closed'::text])));

-- ============================================================================
-- Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.allocate_membership_id(year_block text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  safe_block text := btrim(coalesce(year_block, ''));
  next_serial integer;
begin
  if auth.role() is distinct from 'service_role' and not public.has_permission('admin.membership.manage') then
    raise exception 'Insufficient permission to allocate membership IDs.'
      using errcode = '42501';
  end if;

  if safe_block !~ '^[0-9]{4}$' then
    raise exception 'Membership ID block must be exactly four digits.';
  end if;

  insert into public.membership_id_sequences (year_block, last_serial)
  values (safe_block, 0)
  on conflict (year_block) do nothing;

  update public.membership_id_sequences
  set last_serial = last_serial + 1
  where year_block = safe_block
    and last_serial < 999
  returning last_serial into next_serial;

  if next_serial is null then
    raise exception 'Membership ID block % has no remaining serials.', safe_block;
  end if;

  return 'JNUITS-' || safe_block || lpad(next_serial::text, 3, '0');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.assign_advisor_jnuits_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  next_num bigint;
  prefix text;
  sequence_name text;
begin
  if new.advisor_type = 'main_advisor' then
    prefix := 'CA';
    sequence_name := 'public.advisor_ca_id_seq';
  elsif new.advisor_type = 'moderator_mentor' then
    prefix := 'MOD';
    sequence_name := 'public.advisor_mod_id_seq';
  else
    prefix := 'RA';
    sequence_name := 'public.advisor_ra_id_seq';
  end if;

  if new.advisor_jnuits_id is null or btrim(new.advisor_jnuits_id) = '' then
    execute format('select nextval(%L)', sequence_name) into next_num;
    new.advisor_jnuits_id := 'JNUITS-' || prefix || lpad(next_num::text, 4, '0');
  else
    new.advisor_jnuits_id := upper(btrim(new.advisor_jnuits_id));
  end if;

  if new.left_on is not null then
    new.is_current := false;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bump_claim_version_from_member_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.bump_user_claim_version(old.user_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform public.bump_user_claim_version(new.user_id);
  end if;

  return coalesce(new, old);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bump_claim_version_from_role_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.bump_user_claim_version(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bump_user_claim_version(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if target_user_id is null then
    return;
  end if;

  insert into public.rbac_user_claim_versions (user_id, version, updated_at)
  values (target_user_id, 1, timezone('utc', now()))
  on conflict (user_id) do update
  set
    version = public.rbac_user_claim_versions.version + 1,
    updated_at = timezone('utc', now());
end;
$function$
;

CREATE OR REPLACE FUNCTION public.can_access_mentorship_relationship(target_relationship_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.mentorship_relationships as relationships
    where relationships.id = target_relationship_id
      and (
        relationships.member_user_id = auth.uid()
        or relationships.alumni_user_id = auth.uid()
        or public.has_permission('portal.community.moderate')
        or public.has_permission('admin.support.manage')
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.can_access_support_ticket(target_ticket_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.support_tickets as tickets
    where tickets.id = target_ticket_id
      and (
        tickets.opened_by_user_id = auth.uid()
        or tickets.assigned_to_user_id = auth.uid()
        or public.has_permission('admin.support.manage')
        or (
          tickets.audience_scope = 'member'
          and public.has_permission('portal.tickets.manage_member')
        )
        or (
          tickets.audience_scope = 'alumni'
          and public.has_permission('portal.tickets.manage_alumni')
        )
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.can_manage_support_ticket(target_ticket_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.support_tickets as tickets
    where tickets.id = target_ticket_id
      and (
        public.has_permission('admin.support.manage')
        or tickets.assigned_to_user_id = auth.uid()
        or (
          tickets.audience_scope = 'member'
          and public.has_permission('portal.tickets.manage_member')
        )
        or (
          tickets.audience_scope = 'alumni'
          and public.has_permission('portal.tickets.manage_alumni')
        )
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.commit_bulk_membership_operation(target_operation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  operation_record public.bulk_operations%rowtype;
begin
  if auth.role() is distinct from 'service_role' and not public.has_permission('admin.bulk.manage') then
    raise exception 'Insufficient permission to commit bulk operations.'
      using errcode = '42501';
  end if;

  select *
    into operation_record
  from public.bulk_operations
  where id = target_operation_id
  for update;

  if not found then
    raise exception 'Bulk operation was not found.';
  end if;

  if operation_record.status = 'committed' then
    return jsonb_build_object(
      'operation_id', target_operation_id,
      'status', 'committed',
      'committed_rows', operation_record.committed_rows
    );
  end if;

  if operation_record.status <> 'previewed' or operation_record.error_rows > 0 then
    raise exception 'Bulk operation must be previewed with zero row errors before commit.';
  end if;

  raise exception 'Bulk operation type % is staged but not yet implemented in commit handler.', operation_record.operation_type;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.current_admin_role()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select nullif(auth.jwt() ->> 'jnuits_admin_role', '');
$function$
;

CREATE OR REPLACE FUNCTION public.current_member_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select members.id
  from public.members
  where members.user_id = auth.uid()
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.current_member_type()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select members.member_type
  from public.members
  where members.user_id = auth.uid()
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.current_portal_role()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select nullif(auth.jwt() ->> 'jnuits_portal_role', '');
$function$
;

CREATE OR REPLACE FUNCTION public.current_rbac_claims_snapshot()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with active_roles as (
    select roles.scope, roles.code
    from public.rbac_user_platform_roles as grants
    join public.rbac_platform_roles as roles
      on roles.id = grants.role_id
    where grants.user_id = auth.uid()
      and grants.revoked_at is null
  ),
  reduced_roles as (
    select
      max(code) filter (where scope = 'admin') as admin_role,
      max(code) filter (where scope = 'portal') as portal_role
    from active_roles
  ),
  member_row as (
    select members.id
    from public.members
    where members.user_id = auth.uid()
    limit 1
  )
  select jsonb_build_object(
    'jnuits_admin_role', reduced_roles.admin_role,
    'jnuits_portal_role', reduced_roles.portal_role,
    'jnuits_portals', array_remove(array[
      case when reduced_roles.admin_role is not null then 'admin' end,
      case when reduced_roles.portal_role is not null then 'portal' end
    ], null),
    'jnuits_member_id', (select member_row.id::text from member_row),
    'jnuits_role_version', coalesce((
      select versions.version
      from public.rbac_user_claim_versions as versions
      where versions.user_id = auth.uid()
      limit 1
    ), 1)
  )
  from reduced_roles;
$function$
;

CREATE OR REPLACE FUNCTION public.finalize_member_invitation_claim(target_user_id uuid, target_email text, target_member_id uuid, target_invitation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  member_record public.members%rowtype;
  invitation_record public.member_invitations%rowtype;
  role_id uuid;
  role_code text;
  now_value timestamptz := timezone('utc', now());
  newly_claimed boolean := false;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only service-role callers can finalize member invitation claims.'
      using errcode = '42501';
  end if;

  if target_user_id is null or target_email is null or target_member_id is null or target_invitation_id is null then
    raise exception 'Missing claim finalization input.';
  end if;

  select *
    into member_record
  from public.members
  where id = target_member_id
  for update;

  if not found then
    raise exception 'Member profile was not found.';
  end if;

  if member_record.user_id is not null and member_record.user_id <> target_user_id then
    raise exception 'This member profile is already claimed.';
  end if;

  select *
    into invitation_record
  from public.member_invitations
  where id = target_invitation_id
    and member_id = target_member_id
  for update;

  if not found then
    raise exception 'Invitation was not found.';
  end if;

  if not invitation_record.is_active or invitation_record.revoked_at is not null then
    raise exception 'This invitation is no longer active.';
  end if;

  if invitation_record.used_count >= invitation_record.max_uses
    and member_record.user_id is distinct from target_user_id
  then
    raise exception 'This invitation has already been used.';
  end if;

  if invitation_record.expires_at < now_value then
    raise exception 'This invitation has expired.';
  end if;

  if member_record.user_id is null then
    newly_claimed := true;

    update public.members
    set
      email = target_email,
      user_id = target_user_id,
      is_profile_claimed = true,
      profile_claimed_at = now_value,
      updated_at = now_value
    where id = target_member_id;

    update public.member_invitations
    set
      used_count = used_count + 1,
      last_used_at = now_value,
      updated_at = now_value
    where id = target_invitation_id;
  else
    update public.members
    set
      email = target_email,
      is_profile_claimed = true,
      updated_at = now_value
    where id = target_member_id;
  end if;

  role_code := case
    when member_record.member_type = 'alumni' then 'alumni'
    else 'member'
  end;

  select id
    into role_id
  from public.rbac_platform_roles
  where code = role_code
    and scope = 'portal'
  limit 1;

  if role_id is null then
    raise exception 'Portal role % is not configured.', role_code;
  end if;

  insert into public.rbac_user_platform_roles (
    user_id,
    role_id,
    note
  )
  select target_user_id, role_id, 'Granted after verified member invitation claim.'
  where not exists (
    select 1
    from public.rbac_user_platform_roles as grants
    where grants.user_id = target_user_id
      and grants.scope = 'portal'
      and grants.revoked_at is null
  );

  insert into public.security_events (
    actor_user_id,
    target_user_id,
    event_type,
    severity,
    payload
  )
  values (
    target_user_id,
    target_user_id,
    case when newly_claimed then 'member.profile_claim_finalized' else 'member.profile_claim_refreshed' end,
    'info',
    jsonb_build_object(
      'member_id', target_member_id,
      'invitation_id', target_invitation_id,
      'role_code', role_code
    )
  );

  return jsonb_build_object(
    'member_id', target_member_id,
    'newly_claimed', newly_claimed,
    'role_code', role_code
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.format_jnuits_id(raw_id text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when raw_id is null or btrim(raw_id) = '' then ''
    when upper(btrim(raw_id)) ~ '^JNUITS-' then 'JnUITS-' || substring(upper(btrim(raw_id)) from '^JNUITS-(.+)$')
    else 'JnUITS-' || upper(btrim(raw_id))
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- public.members is the canonical identity table. This legacy hook remains
  -- installed for rollback compatibility, but intentionally stops writing the
  -- deprecated public.profiles mirror.
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.has_permission(requested_permission text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    return false;
  end if;

  if public.is_super_admin() then
    return true;
  end if;

  return exists(
    select 1
    from public.rbac_user_platform_roles as grants
    join public.rbac_role_permissions as role_permissions
      on role_permissions.role_id = grants.role_id
    where grants.user_id = auth.uid()
      and grants.revoked_at is null
      and role_permissions.permission_code = requested_permission
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.has_platform_role(role_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.rbac_user_platform_roles as user_roles
    join public.rbac_platform_roles as roles
      on roles.id = user_roles.role_id
    where user_roles.user_id = auth.uid()
      and user_roles.revoked_at is null
      and (
        roles.code = role_code
        or (
          roles.code = 'super_admin'
          and role_code = any (array['super_admin', 'admin', 'content_admin'])
        )
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_aal2()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin_totp_enforced()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(
    (
      select settings.admin_totp_enforced
      from public.security_settings as settings
      where settings.id = true
      limit 1
    ),
    true
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.rbac_user_platform_roles as grants
    join public.rbac_platform_roles as roles
      on roles.id = grants.role_id
    where grants.user_id = auth.uid()
      and grants.revoked_at is null
      and roles.code = 'super_admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_super_admin_user(target_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.rbac_user_platform_roles as grants
    join public.rbac_platform_roles as roles
      on roles.id = grants.role_id
    where grants.user_id = target_user_id
      and grants.revoked_at is null
      and roles.scope = 'admin'
      and roles.code = 'super_admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.jnuits_custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  user_uuid uuid;
  admin_role text;
  portal_role text;
  member_id uuid;
  claim_version bigint := 1;
  portals text[];
begin
  user_uuid := nullif(event ->> 'user_id', '')::uuid;

  if user_uuid is null then
    return jsonb_build_object('claims', claims);
  end if;

  with active_roles as (
    select roles.scope, roles.code
    from public.rbac_user_platform_roles as grants
    join public.rbac_platform_roles as roles
      on roles.id = grants.role_id
    where grants.user_id = user_uuid
      and grants.revoked_at is null
  ),
  reduced_roles as (
    select
      max(code) filter (where scope = 'admin') as admin_role,
      max(code) filter (where scope = 'portal') as portal_role
    from active_roles
  )
  select
    reduced_roles.admin_role,
    reduced_roles.portal_role,
    members.id,
    coalesce(role_versions.version, 1)
  into
    admin_role,
    portal_role,
    member_id,
    claim_version
  from reduced_roles
  left join public.members
    on members.user_id = user_uuid
  left join public.rbac_user_claim_versions as role_versions
    on role_versions.user_id = user_uuid;

  portals := array_remove(
    array[
      case when admin_role is not null then 'admin' end,
      case when portal_role is not null then 'portal' end
    ],
    null
  );

  claims := jsonb_set(
    claims,
    '{jnuits_admin_role}',
    coalesce(to_jsonb(admin_role), 'null'::jsonb),
    true
  );
  claims := jsonb_set(
    claims,
    '{jnuits_portal_role}',
    coalesce(to_jsonb(portal_role), 'null'::jsonb),
    true
  );
  claims := jsonb_set(
    claims,
    '{jnuits_portals}',
    to_jsonb(coalesce(portals, array[]::text[])),
    true
  );
  claims := jsonb_set(
    claims,
    '{jnuits_member_id}',
    coalesce(to_jsonb(member_id::text), 'null'::jsonb),
    true
  );
  claims := jsonb_set(
    claims,
    '{jnuits_role_version}',
    to_jsonb(claim_version),
    true
  );

  return jsonb_build_object('claims', claims);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.log_auth_user_security_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.encrypted_password is distinct from new.encrypted_password then
    insert into public.security_events (
      target_user_id,
      event_type,
      severity,
      payload
    )
    values (
      new.id,
      'auth.password_changed',
      'warning',
      '{}'::jsonb
    );
  end if;

  if old.email is distinct from new.email then
    insert into public.security_events (
      target_user_id,
      event_type,
      severity,
      payload
    )
    values (
      new.id,
      'auth.email_changed',
      'warning',
      jsonb_build_object(
        'old_email', old.email,
        'new_email', new.email
      )
    );
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.log_member_identity_security_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.user_id is distinct from new.user_id then
    insert into public.security_events (
      actor_user_id,
      target_user_id,
      event_type,
      severity,
      payload
    )
    values (
      new.user_id,
      new.user_id,
      'member.auth_user_link_changed',
      'warning',
      jsonb_build_object(
        'member_id', new.id,
        'previous_user_id', old.user_id,
        'current_user_id', new.user_id
      )
    );
  end if;

  if old.email is distinct from new.email then
    insert into public.security_events (
      actor_user_id,
      target_user_id,
      event_type,
      severity,
      payload
    )
    values (
      new.user_id,
      new.user_id,
      'member.email_changed',
      'warning',
      jsonb_build_object(
        'member_id', new.id,
        'old_email', old.email,
        'new_email', new.email
      )
    );
  end if;

  if old.jnuits_id is distinct from new.jnuits_id then
    insert into public.security_events (
      actor_user_id,
      target_user_id,
      event_type,
      severity,
      payload
    )
    values (
      new.user_id,
      new.user_id,
      'member.jnuits_id_changed',
      'critical',
      jsonb_build_object(
        'member_id', new.id,
        'old_jnuits_id', old.jnuits_id,
        'new_jnuits_id', new.jnuits_id
      )
    );
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.log_mfa_factor_security_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_user uuid := coalesce(new.user_id, old.user_id);
begin
  if tg_op = 'INSERT' and new.status::text = 'verified' then
    insert into public.security_events (
      target_user_id,
      event_type,
      severity,
      payload
    )
    values (
      target_user,
      'auth.mfa.factor_enrolled',
      'warning',
      jsonb_build_object(
        'factor_id', new.id,
        'factor_type', new.factor_type::text,
        'friendly_name', new.friendly_name
      )
    );
  elsif tg_op = 'UPDATE'
    and old.status::text is distinct from new.status::text
    and new.status::text = 'verified'
  then
    insert into public.security_events (
      target_user_id,
      event_type,
      severity,
      payload
    )
    values (
      target_user,
      'auth.mfa.factor_enrolled',
      'warning',
      jsonb_build_object(
        'factor_id', new.id,
        'factor_type', new.factor_type::text,
        'friendly_name', new.friendly_name
      )
    );
  elsif tg_op = 'DELETE' and old.status::text = 'verified' then
    insert into public.security_events (
      target_user_id,
      event_type,
      severity,
      payload
    )
    values (
      target_user,
      'auth.mfa.factor_removed',
      'critical',
      jsonb_build_object(
        'factor_id', old.id,
        'factor_type', old.factor_type::text,
        'friendly_name', old.friendly_name
      )
    );
  end if;

  return coalesce(new, old);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.log_rbac_assignment_security_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_user uuid := coalesce(new.user_id, old.user_id);
  role_code text;
  event_name text;
begin
  select roles.code
    into role_code
  from public.rbac_platform_roles as roles
  where roles.id = coalesce(new.role_id, old.role_id);

  if tg_op = 'INSERT' then
    event_name := 'rbac.role_assignment_granted';
  elsif tg_op = 'DELETE' then
    event_name := 'rbac.role_assignment_deleted';
  elsif old.revoked_at is null and new.revoked_at is not null then
    event_name := 'rbac.role_assignment_revoked';
  else
    event_name := 'rbac.role_assignment_updated';
  end if;

  insert into public.security_events (
    actor_user_id,
    target_user_id,
    event_type,
    severity,
    payload
  )
  values (
    coalesce(new.granted_by, old.granted_by),
    target_user,
    event_name,
    case when role_code = 'super_admin' then 'critical' else 'info' end,
    jsonb_build_object(
      'role_code', role_code,
      'scope', coalesce(new.scope, old.scope),
      'assignment_id', coalesce(new.id, old.id)
    )
  );

  return coalesce(new, old);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.log_security_settings_security_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.admin_totp_enforced is distinct from new.admin_totp_enforced then
    insert into public.security_events (
      actor_user_id,
      target_user_id,
      event_type,
      severity,
      payload
    )
    values (
      new.updated_by_user_id,
      new.updated_by_user_id,
      'admin.security.admin_totp_enforcement_changed',
      case when new.admin_totp_enforced then 'info' else 'critical' end,
      jsonb_build_object(
        'previous', old.admin_totp_enforced,
        'current', new.admin_totp_enforced
      )
    );
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_jnuits_id(raw_id text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when raw_id is null or btrim(raw_id) = '' then ''
    when upper(btrim(raw_id)) ~ '^JNUITS-' then upper(btrim(raw_id))
    else 'JNUITS-' || upper(btrim(raw_id))
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.preview_bulk_membership_operation(target_operation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  total_count integer;
  valid_count integer;
  error_count integer;
begin
  if auth.role() is distinct from 'service_role' and not public.has_permission('admin.bulk.manage') then
    raise exception 'Insufficient permission to preview bulk operations.'
      using errcode = '42501';
  end if;

  select
    count(*),
    count(*) filter (where status = 'valid'),
    count(*) filter (where status = 'error')
  into total_count, valid_count, error_count
  from public.bulk_operation_rows
  where operation_id = target_operation_id;

  update public.bulk_operations
  set
    total_rows = coalesce(total_count, 0),
    valid_rows = coalesce(valid_count, 0),
    error_rows = coalesce(error_count, 0),
    status = 'previewed',
    previewed_at = timezone('utc', now())
  where id = target_operation_id
    and status in ('draft', 'previewed', 'failed');

  if not found then
    raise exception 'Bulk operation was not found or cannot be previewed.';
  end if;

  return jsonb_build_object(
    'operation_id', target_operation_id,
    'total_rows', coalesce(total_count, 0),
    'valid_rows', coalesce(valid_count, 0),
    'error_rows', coalesce(error_count, 0)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_member_lifecycle_status(target_member_id uuid, next_lifecycle_status text, next_portal_access_status text, reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := auth.uid();
  previous_record public.members%rowtype;
  now_value timestamptz := timezone('utc', now());
begin
  if auth.role() is distinct from 'service_role' and not public.has_permission('admin.membership.manage') then
    raise exception 'Insufficient permission to change member lifecycle status.'
      using errcode = '42501';
  end if;

  if not (next_lifecycle_status = any (array['current', 'former', 'alumni', 'deleted'])) then
    raise exception 'Invalid lifecycle status %.', next_lifecycle_status;
  end if;

  if not (next_portal_access_status = any (array['active', 'frozen', 'suspended', 'deletion_requested', 'deactivated'])) then
    raise exception 'Invalid portal access status %.', next_portal_access_status;
  end if;

  select *
    into previous_record
  from public.members
  where id = target_member_id
  for update;

  if not found then
    raise exception 'Member was not found.';
  end if;

  update public.members
  set
    lifecycle_status = next_lifecycle_status,
    portal_access_status = next_portal_access_status,
    lifecycle_changed_at = now_value,
    lifecycle_changed_by_user_id = actor_id,
    lifecycle_note = nullif(btrim(reason), ''),
    member_type = case
      when next_lifecycle_status = 'alumni' then 'alumni'
      when member_type = 'alumni' and next_lifecycle_status = 'current' then 'current'
      else member_type
    end,
    alumni_since = case
      when next_lifecycle_status = 'alumni' then coalesce(alumni_since, now_value::date)
      else alumni_since
    end,
    updated_at = now_value
  where id = target_member_id;

  insert into public.membership_lifecycle_events (
    member_id,
    event_type,
    occurred_at,
    summary,
    metadata,
    created_by_user_id
  )
  values (
    target_member_id,
    'lifecycle_status_changed',
    now_value,
    'Member lifecycle/access status changed.',
    jsonb_build_object(
      'previous_lifecycle_status', previous_record.lifecycle_status,
      'previous_portal_access_status', previous_record.portal_access_status,
      'current_lifecycle_status', next_lifecycle_status,
      'current_portal_access_status', next_portal_access_status,
      'reason', nullif(btrim(reason), '')
    ),
    actor_id
  );

  insert into public.security_events (
    actor_user_id,
    target_user_id,
    event_type,
    severity,
    payload
  )
  values (
    actor_id,
    previous_record.user_id,
    'member.lifecycle_status_changed',
    case
      when next_portal_access_status in ('suspended', 'deactivated') or next_lifecycle_status = 'deleted' then 'warning'
      else 'info'
    end,
    jsonb_build_object(
      'member_id', target_member_id,
      'previous_lifecycle_status', previous_record.lifecycle_status,
      'previous_portal_access_status', previous_record.portal_access_status,
      'current_lifecycle_status', next_lifecycle_status,
      'current_portal_access_status', next_portal_access_status
    )
  );

  return jsonb_build_object(
    'member_id', target_member_id,
    'lifecycle_status', next_lifecycle_status,
    'portal_access_status', next_portal_access_status
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_membership_id_sequence_from_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  normalized_id text := upper(new.jnuits_id::text);
  parsed_year text;
  parsed_serial integer;
begin
  if normalized_id !~ '^JNUITS-[0-9]{7}$' then
    return new;
  end if;

  parsed_year := substring(normalized_id from '^JNUITS-([0-9]{4})[0-9]{3}$');
  parsed_serial := substring(normalized_id from '^JNUITS-[0-9]{4}([0-9]{3})$')::integer;

  insert into public.membership_id_sequences (year_block, last_serial)
  values (parsed_year, parsed_serial)
  on conflict (year_block) do update
  set last_serial = greatest(public.membership_id_sequences.last_serial, excluded.last_serial);

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_user_platform_role_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  resolved_scope text;
begin
  select roles.scope
  into resolved_scope
  from public.rbac_platform_roles as roles
  where roles.id = new.role_id;

  if resolved_scope is null then
    raise exception 'Unable to resolve scope for role_id %', new.role_id;
  end if;

  new.scope = resolved_scope;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_advisor_speech_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.speech is distinct from old.speech then
    new.speech_updated_at = timezone('utc', now());
  end if;

  return new;
end;
$function$
;

-- ============================================================================
-- Triggers
-- ============================================================================

CREATE TRIGGER admin_profiles_updated_at BEFORE UPDATE ON public.admin_profiles FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER advisor_profiles_assign_advisor_jnuits_id BEFORE INSERT OR UPDATE OF advisor_jnuits_id, advisor_type, left_on ON public.advisor_profiles FOR EACH ROW EXECUTE FUNCTION assign_advisor_jnuits_id();

CREATE TRIGGER advisor_profiles_set_updated_at BEFORE UPDATE ON public.advisor_profiles FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER advisor_profiles_speech_timestamp BEFORE UPDATE ON public.advisor_profiles FOR EACH ROW EXECUTE FUNCTION update_advisor_speech_timestamp();

CREATE TRIGGER bulk_operation_rows_updated_at BEFORE UPDATE ON public.bulk_operation_rows FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER bulk_operations_updated_at BEFORE UPDATE ON public.bulk_operations FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER certificates_set_updated_at BEFORE UPDATE ON public.certificates FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER committee_assignments_set_updated_at BEFORE UPDATE ON public.committee_assignments FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER committee_roles_set_updated_at BEFORE UPDATE ON public.committee_roles FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER committee_terms_set_updated_at BEFORE UPDATE ON public.committee_terms FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER contact_settings_set_updated_at BEFORE UPDATE ON public.contact_settings FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER content_pages_set_updated_at BEFORE UPDATE ON public.content_pages FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER content_posts_set_updated_at BEFORE UPDATE ON public.content_posts FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER departments_set_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER developer_profiles_set_updated_at BEFORE UPDATE ON public.developer_profiles FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER events_set_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER gallery_album_items_set_updated_at BEFORE UPDATE ON public.gallery_album_items FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER gallery_albums_set_updated_at BEFORE UPDATE ON public.gallery_albums FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER gallery_entries_set_updated_at BEFORE UPDATE ON public.gallery_entries FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER invitation_batches_set_updated_at BEFORE UPDATE ON public.invitation_batches FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER media_assets_set_updated_at BEFORE UPDATE ON public.media_assets FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER member_invitations_set_updated_at BEFORE UPDATE ON public.member_invitations FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER members_bump_claim_version AFTER INSERT OR DELETE OR UPDATE OF user_id ON public.members FOR EACH ROW EXECUTE FUNCTION bump_claim_version_from_member_link();

CREATE TRIGGER members_identity_security_event AFTER UPDATE OF email, jnuits_id, user_id ON public.members FOR EACH ROW EXECUTE FUNCTION log_member_identity_security_event();

CREATE TRIGGER members_set_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER members_sync_membership_id_sequence AFTER INSERT OR UPDATE OF jnuits_id ON public.members FOR EACH ROW EXECUTE FUNCTION sync_membership_id_sequence_from_member();

CREATE TRIGGER membership_applications_set_updated_at BEFORE UPDATE ON public.membership_applications FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER membership_cycle_memberships_set_updated_at BEFORE UPDATE ON public.membership_cycle_memberships FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER membership_cycles_set_updated_at BEFORE UPDATE ON public.membership_cycles FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER membership_id_sequences_updated_at BEFORE UPDATE ON public.membership_id_sequences FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER mentorship_profiles_set_updated_at BEFORE UPDATE ON public.mentorship_profiles FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER portal_user_settings_set_updated_at BEFORE UPDATE ON public.portal_user_settings FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER profile_update_requests_set_updated_at BEFORE UPDATE ON public.profile_update_requests FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER rbac_user_platform_roles_bump_claim_version AFTER INSERT OR DELETE OR UPDATE ON public.rbac_user_platform_roles FOR EACH ROW EXECUTE FUNCTION bump_claim_version_from_role_assignment();

CREATE TRIGGER rbac_user_platform_roles_security_event AFTER INSERT OR DELETE OR UPDATE ON public.rbac_user_platform_roles FOR EACH ROW EXECUTE FUNCTION log_rbac_assignment_security_event();

CREATE TRIGGER rbac_user_platform_roles_sync_scope BEFORE INSERT OR UPDATE OF role_id ON public.rbac_user_platform_roles FOR EACH ROW EXECUTE FUNCTION sync_user_platform_role_scope();

CREATE TRIGGER security_settings_security_event AFTER UPDATE ON public.security_settings FOR EACH ROW EXECUTE FUNCTION log_security_settings_security_event();

CREATE TRIGGER security_settings_set_updated_at BEFORE UPDATE ON public.security_settings FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER support_tickets_set_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

CREATE TRIGGER trg_invitation_email_deliveries_updated_at BEFORE UPDATE ON public.invitation_email_deliveries FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.admin_profiles enable row level security;

alter table public.advisor_profiles enable row level security;

alter table public.audit_events enable row level security;

alter table public.blog_review_events enable row level security;

alter table public.bulk_operation_rows enable row level security;

alter table public.bulk_operations enable row level security;

alter table public.certificate_import_batches enable row level security;

alter table public.certificates enable row level security;

alter table public.certificates_import_staging enable row level security;

alter table public.committee_assignments enable row level security;

alter table public.committee_roles enable row level security;

alter table public.committee_terms enable row level security;

alter table public.contact_settings enable row level security;

alter table public.content_pages enable row level security;

alter table public.content_posts enable row level security;

alter table public.departments enable row level security;

alter table public.developer_profiles enable row level security;

alter table public.event_registrations enable row level security;

alter table public.events enable row level security;

alter table public.gallery_album_items enable row level security;

alter table public.gallery_albums enable row level security;

alter table public.gallery_entries enable row level security;

alter table public.invitation_batches enable row level security;

alter table public.invitation_email_deliveries enable row level security;

alter table public.media_assets enable row level security;

alter table public.member_invitations enable row level security;

alter table public.members enable row level security;

alter table public.membership_applications enable row level security;

alter table public.membership_cycle_memberships enable row level security;

alter table public.membership_cycles enable row level security;

alter table public.membership_id_sequences enable row level security;

alter table public.membership_lifecycle_events enable row level security;

alter table public.mentorship_messages enable row level security;

alter table public.mentorship_profiles enable row level security;

alter table public.mentorship_relationships enable row level security;

alter table public.operator_reports enable row level security;

alter table public.portal_user_settings enable row level security;

alter table public.profile_update_requests enable row level security;

alter table public.profiles enable row level security;

alter table public.project_contributors enable row level security;

alter table public.projects enable row level security;

alter table public.rbac_permissions enable row level security;

alter table public.rbac_platform_roles enable row level security;

alter table public.rbac_role_permissions enable row level security;

alter table public.rbac_user_claim_versions enable row level security;

alter table public.rbac_user_platform_roles enable row level security;

alter table public.security_events enable row level security;

alter table public.security_settings enable row level security;

alter table public.support_ticket_events enable row level security;

alter table public.support_ticket_messages enable row level security;

alter table public.support_tickets enable row level security;

-- ============================================================================
-- Policies
-- ============================================================================

create policy "admin profiles managed delete" on public.admin_profiles as permissive for delete to authenticated
using (((current_admin_role() = 'super_admin'::text) OR (has_permission('admin.admin_profiles.manage'::text) AND (NOT is_super_admin_user(user_id)))));

create policy "admin profiles managed insert" on public.admin_profiles as permissive for insert to authenticated
with check (((current_admin_role() = 'super_admin'::text) OR (has_permission('admin.admin_profiles.manage'::text) AND (NOT is_super_admin_user(user_id)))));

create policy "admin profiles managed update" on public.admin_profiles as permissive for update to authenticated
using (((current_admin_role() = 'super_admin'::text) OR (has_permission('admin.admin_profiles.manage'::text) AND (NOT is_super_admin_user(user_id)))))
with check (((current_admin_role() = 'super_admin'::text) OR (has_permission('admin.admin_profiles.manage'::text) AND (NOT is_super_admin_user(user_id)))));

create policy "admin profiles self or admin read" on public.admin_profiles as permissive for select to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) OR (current_admin_role() = 'super_admin'::text) OR (has_permission('admin.admin_profiles.manage'::text) AND (NOT is_super_admin_user(user_id)))));

create policy "advisor profiles committee admin manage" on public.advisor_profiles as permissive for all to authenticated
using (has_permission('admin.committee.manage'::text))
with check (has_permission('admin.committee.manage'::text));

create policy "advisor profiles current speech public read" on public.advisor_profiles as permissive for select to anon, authenticated
using (((is_public = true) AND (is_current = true) AND (speech IS NOT NULL) AND (btrim(speech) <> ''::text)));

create policy "advisor profiles own read" on public.advisor_profiles as permissive for select to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));

create policy "advisor profiles own update" on public.advisor_profiles as permissive for update to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)))
with check ((user_id = ( SELECT auth.uid() AS uid)));

create policy "advisor profiles public read" on public.advisor_profiles as permissive for select to anon, authenticated
using ((is_public = true));

create policy "audit events operator read" on public.audit_events as permissive for select to public
using ((has_platform_role('admin'::text) OR has_platform_role('moderator'::text)));

create policy "blog review events insert access" on public.blog_review_events as permissive for insert to authenticated
with check ((has_permission('cms.blogs.review'::text) OR has_permission('portal.blogs.submit'::text)));

create policy "blog review events select access" on public.blog_review_events as permissive for select to authenticated
using ((has_permission('cms.blogs.review'::text) OR (EXISTS ( SELECT 1
   FROM content_posts posts
  WHERE ((posts.id = blog_review_events.post_id) AND ((posts.author_member_id = current_member_id()) OR (EXISTS ( SELECT 1
           FROM advisor_profiles
          WHERE ((advisor_profiles.id = posts.author_advisor_profile_id) AND (advisor_profiles.user_id = ( SELECT auth.uid() AS uid)))))))))));

create policy "bulk operation rows membership admins" on public.bulk_operation_rows as permissive for all to authenticated
using (has_permission('admin.bulk.manage'::text))
with check (has_permission('admin.bulk.manage'::text));

create policy "bulk operations membership admins" on public.bulk_operations as permissive for all to authenticated
using (has_permission('admin.bulk.manage'::text))
with check (has_permission('admin.bulk.manage'::text));

create policy "certificate import batches operator read" on public.certificate_import_batches as permissive for select to public
using ((has_platform_role('admin'::text) OR has_platform_role('moderator'::text)));

create policy "certificate import staging operator read" on public.certificates_import_staging as permissive for select to public
using ((has_platform_role('admin'::text) OR has_platform_role('moderator'::text)));

create policy "certificates are publicly readable" on public.certificates as permissive for select to public
using (true);

create policy "committee assignments committee admin manage" on public.committee_assignments as permissive for all to authenticated
using (has_permission('admin.committee.manage'::text))
with check (has_permission('admin.committee.manage'::text));

create policy "committee assignments operator delete" on public.committee_assignments as permissive for delete to authenticated
using (has_platform_role('admin'::text));

create policy "committee assignments operator insert" on public.committee_assignments as permissive for insert to authenticated
with check (has_platform_role('admin'::text));

create policy "committee assignments operator update" on public.committee_assignments as permissive for update to authenticated
using (has_platform_role('admin'::text));

create policy "committee assignments public read" on public.committee_assignments as permissive for select to anon, authenticated
using (((status <> 'planned'::text) AND (is_public = true) AND (EXISTS ( SELECT 1
   FROM committee_terms
  WHERE ((committee_terms.id = committee_assignments.term_id) AND (committee_terms.is_public = true) AND (committee_terms.status = ANY (ARRAY['upcoming'::text, 'active'::text, 'archived'::text]))))) AND (EXISTS ( SELECT 1
   FROM committee_roles
  WHERE ((committee_roles.id = committee_assignments.role_id) AND (committee_roles.is_public = true) AND (committee_roles.role_group = 'executive'::text))))));

create policy "committee roles committee admin manage" on public.committee_roles as permissive for all to authenticated
using (has_permission('admin.committee.manage'::text))
with check (has_permission('admin.committee.manage'::text));

create policy "committee roles operator delete" on public.committee_roles as permissive for delete to authenticated
using (has_platform_role('admin'::text));

create policy "committee roles operator insert" on public.committee_roles as permissive for insert to authenticated
with check (has_platform_role('admin'::text));

create policy "committee roles operator update" on public.committee_roles as permissive for update to authenticated
using (has_platform_role('admin'::text));

create policy "committee roles public read" on public.committee_roles as permissive for select to anon, authenticated
using ((is_public = true));

create policy "committee terms committee admin manage" on public.committee_terms as permissive for all to authenticated
using (has_permission('admin.committee.manage'::text))
with check (has_permission('admin.committee.manage'::text));

create policy "committee terms operator delete" on public.committee_terms as permissive for delete to authenticated
using (has_platform_role('admin'::text));

create policy "committee terms operator insert" on public.committee_terms as permissive for insert to authenticated
with check (has_platform_role('admin'::text));

create policy "committee terms operator update" on public.committee_terms as permissive for update to authenticated
using (has_platform_role('admin'::text));

create policy "committee terms public read" on public.committee_terms as permissive for select to anon, authenticated
using (((is_public = true) AND (status = ANY (ARRAY['upcoming'::text, 'active'::text, 'archived'::text]))));

create policy "contact settings admin delete" on public.contact_settings as permissive for delete to authenticated
using (has_permission('admin.settings.write'::text));

create policy "contact settings admin insert" on public.contact_settings as permissive for insert to authenticated
with check (has_permission('admin.settings.write'::text));

create policy "contact settings admin read" on public.contact_settings as permissive for select to authenticated
using (has_permission('admin.settings.read'::text));

create policy "contact settings admin update" on public.contact_settings as permissive for update to authenticated
using (has_permission('admin.settings.write'::text))
with check (has_permission('admin.settings.write'::text));

create policy "contact settings public read" on public.contact_settings as permissive for select to anon, authenticated
using ((is_public = true));

create policy "content pages operator delete" on public.content_pages as permissive for delete to authenticated
using (has_platform_role('admin'::text));

create policy "content pages operator insert" on public.content_pages as permissive for insert to authenticated
with check (has_platform_role('admin'::text));

create policy "content pages operator update" on public.content_pages as permissive for update to authenticated
using (has_platform_role('admin'::text));

create policy "content pages public read" on public.content_pages as permissive for select to anon, authenticated
using ((status = 'published'::text));

create policy "content posts admin delete" on public.content_posts as permissive for delete to authenticated
using ((((content_type = 'blog'::text) AND has_permission('cms.blogs.publish'::text)) OR ((content_type = 'notice'::text) AND has_permission('cms.notices.manage'::text)) OR ((content_type = 'event'::text) AND has_permission('cms.events.manage'::text))));

create policy "content posts admin insert" on public.content_posts as permissive for insert to authenticated
with check ((((content_type = 'blog'::text) AND has_permission('cms.blogs.review'::text)) OR ((content_type = 'notice'::text) AND has_permission('cms.notices.manage'::text)) OR ((content_type = 'event'::text) AND has_permission('cms.events.manage'::text))));

create policy "content posts admin select" on public.content_posts as permissive for select to authenticated
using ((((content_type = 'blog'::text) AND has_permission('cms.blogs.review'::text)) OR ((content_type = 'notice'::text) AND has_permission('cms.notices.manage'::text)) OR ((content_type = 'event'::text) AND has_permission('cms.events.manage'::text))));

create policy "content posts admin update" on public.content_posts as permissive for update to authenticated
using ((((content_type = 'blog'::text) AND has_permission('cms.blogs.review'::text)) OR ((content_type = 'notice'::text) AND has_permission('cms.notices.manage'::text)) OR ((content_type = 'event'::text) AND has_permission('cms.events.manage'::text))))
with check ((((content_type = 'blog'::text) AND has_permission('cms.blogs.review'::text)) OR ((content_type = 'notice'::text) AND has_permission('cms.notices.manage'::text)) OR ((content_type = 'event'::text) AND has_permission('cms.events.manage'::text))));

create policy "content posts author insert" on public.content_posts as permissive for insert to authenticated
with check (((content_type = 'blog'::text) AND has_permission('portal.blogs.submit'::text) AND (status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'change_requested'::text])) AND ((author_member_id = current_member_id()) OR (EXISTS ( SELECT 1
   FROM advisor_profiles
  WHERE ((advisor_profiles.id = content_posts.author_advisor_profile_id) AND (advisor_profiles.user_id = ( SELECT auth.uid() AS uid))))))));

create policy "content posts author select" on public.content_posts as permissive for select to authenticated
using (((content_type = 'blog'::text) AND ((author_member_id = current_member_id()) OR (EXISTS ( SELECT 1
   FROM advisor_profiles
  WHERE ((advisor_profiles.id = content_posts.author_advisor_profile_id) AND (advisor_profiles.user_id = ( SELECT auth.uid() AS uid))))))));

create policy "content posts author update" on public.content_posts as permissive for update to authenticated
using (((content_type = 'blog'::text) AND ((author_member_id = current_member_id()) OR (EXISTS ( SELECT 1
   FROM advisor_profiles
  WHERE ((advisor_profiles.id = content_posts.author_advisor_profile_id) AND (advisor_profiles.user_id = ( SELECT auth.uid() AS uid))))))))
with check (((content_type = 'blog'::text) AND has_permission('portal.blogs.submit'::text) AND (status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'change_requested'::text])) AND ((author_member_id = current_member_id()) OR (EXISTS ( SELECT 1
   FROM advisor_profiles
  WHERE ((advisor_profiles.id = content_posts.author_advisor_profile_id) AND (advisor_profiles.user_id = ( SELECT auth.uid() AS uid))))))));

create policy "content posts public read" on public.content_posts as permissive for select to anon, authenticated
using ((status = 'published'::text));

create policy "departments are publicly readable" on public.departments as permissive for select to public
using (true);

create policy "developer profiles operator delete" on public.developer_profiles as permissive for delete to authenticated
using (has_platform_role('admin'::text));

create policy "developer profiles operator insert" on public.developer_profiles as permissive for insert to authenticated
with check (has_platform_role('admin'::text));

create policy "developer profiles operator update" on public.developer_profiles as permissive for update to authenticated
using (has_platform_role('admin'::text));

create policy "developer profiles public read" on public.developer_profiles as permissive for select to anon, authenticated
using ((status = 'published'::text));

create policy "event_registrations operator update" on public.event_registrations as permissive for update to public
using ((has_platform_role('admin'::text) OR has_platform_role('super_admin'::text)));

create policy "event_registrations unified select" on public.event_registrations as permissive for select to public
using (true);

create policy "events operator delete" on public.events as permissive for delete to authenticated
using ((has_platform_role('super_admin'::text) OR has_platform_role('admin'::text) OR has_platform_role('moderator'::text) OR has_platform_role('content_editor'::text)));

create policy "events operator insert" on public.events as permissive for insert to authenticated
with check ((has_platform_role('super_admin'::text) OR has_platform_role('admin'::text) OR has_platform_role('moderator'::text) OR has_platform_role('content_editor'::text)));

create policy "events operator update" on public.events as permissive for update to authenticated
using ((has_platform_role('super_admin'::text) OR has_platform_role('admin'::text) OR has_platform_role('moderator'::text) OR has_platform_role('content_editor'::text)))
with check ((has_platform_role('super_admin'::text) OR has_platform_role('admin'::text) OR has_platform_role('moderator'::text) OR has_platform_role('content_editor'::text)));

create policy "events public read" on public.events as permissive for select to anon, authenticated
using ((status = 'published'::text));

create policy "gallery album items operator delete" on public.gallery_album_items as permissive for delete to authenticated
using ((has_platform_role('super_admin'::text) OR has_platform_role('admin'::text) OR has_platform_role('moderator'::text) OR has_platform_role('content_editor'::text)));

create policy "gallery album items operator insert" on public.gallery_album_items as permissive for insert to authenticated
with check ((has_platform_role('super_admin'::text) OR has_platform_role('admin'::text) OR has_platform_role('moderator'::text) OR has_platform_role('content_editor'::text)));

create policy "gallery album items operator update" on public.gallery_album_items as permissive for update to authenticated
using ((has_platform_role('super_admin'::text) OR has_platform_role('admin'::text) OR has_platform_role('moderator'::text) OR has_platform_role('content_editor'::text)))
with check ((has_platform_role('super_admin'::text) OR has_platform_role('admin'::text) OR has_platform_role('moderator'::text) OR has_platform_role('content_editor'::text)));

create policy "gallery album items public read" on public.gallery_album_items as permissive for select to anon, authenticated
using (((status = 'published'::text) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM gallery_albums
  WHERE ((gallery_albums.id = gallery_album_items.album_id) AND (gallery_albums.status = 'published'::text) AND (gallery_albums.deleted_at IS NULL)))) AND (EXISTS ( SELECT 1
   FROM media_assets
  WHERE ((media_assets.id = gallery_album_items.media_asset_id) AND (media_assets.is_public = true) AND (media_assets.deleted_at IS NULL))))));

create policy "gallery albums operator delete" on public.gallery_albums as permissive for delete to authenticated
using ((has_platform_role('super_admin'::text) OR has_platform_role('admin'::text) OR has_platform_role('moderator'::text) OR has_platform_role('content_editor'::text)));

create policy "gallery albums operator insert" on public.gallery_albums as permissive for insert to authenticated
with check ((has_platform_role('super_admin'::text) OR has_platform_role('admin'::text) OR has_platform_role('moderator'::text) OR has_platform_role('content_editor'::text)));

create policy "gallery albums operator update" on public.gallery_albums as permissive for update to authenticated
using ((has_platform_role('super_admin'::text) OR has_platform_role('admin'::text) OR has_platform_role('moderator'::text) OR has_platform_role('content_editor'::text)))
with check ((has_platform_role('super_admin'::text) OR has_platform_role('admin'::text) OR has_platform_role('moderator'::text) OR has_platform_role('content_editor'::text)));

create policy "gallery albums public read" on public.gallery_albums as permissive for select to anon, authenticated
using (((status = 'published'::text) AND (deleted_at IS NULL)));

create policy "gallery entries operator delete" on public.gallery_entries as permissive for delete to authenticated
using (has_platform_role('admin'::text));

create policy "gallery entries operator insert" on public.gallery_entries as permissive for insert to authenticated
with check (has_platform_role('admin'::text));

create policy "gallery entries operator update" on public.gallery_entries as permissive for update to authenticated
using (has_platform_role('admin'::text));

create policy "gallery entries public read" on public.gallery_entries as permissive for select to anon, authenticated
using (((status = 'published'::text) AND (EXISTS ( SELECT 1
   FROM media_assets
  WHERE ((media_assets.id = gallery_entries.media_asset_id) AND (media_assets.is_public = true))))));

create policy "invitation batches membership admins" on public.invitation_batches as permissive for all to authenticated
using (( SELECT has_permission('admin.membership.manage'::text) AS has_permission))
with check (( SELECT has_permission('admin.membership.manage'::text) AS has_permission));

create policy "invitation batches operator read" on public.invitation_batches as permissive for select to authenticated
using ((( SELECT has_platform_role('admin'::text) AS has_platform_role) OR ( SELECT has_platform_role('moderator'::text) AS has_platform_role)));

create policy "invitation email deliveries membership admins" on public.invitation_email_deliveries as permissive for all to authenticated
using (( SELECT has_permission('admin.membership.manage'::text) AS has_permission))
with check (( SELECT has_permission('admin.membership.manage'::text) AS has_permission));

create policy "lifecycle events operator delete" on public.membership_lifecycle_events as permissive for delete to authenticated
using (has_platform_role('admin'::text));

create policy "lifecycle events operator insert" on public.membership_lifecycle_events as permissive for insert to authenticated
with check (has_platform_role('admin'::text));

create policy "lifecycle events operator update" on public.membership_lifecycle_events as permissive for update to authenticated
using (has_platform_role('admin'::text));

create policy "lifecycle own or operator read" on public.membership_lifecycle_events as permissive for select to public
using (((EXISTS ( SELECT 1
   FROM members
  WHERE ((members.id = membership_lifecycle_events.member_id) AND (members.user_id = ( SELECT auth.uid() AS uid))))) OR has_platform_role('admin'::text) OR has_platform_role('moderator'::text)));

create policy "media assets operator delete" on public.media_assets as permissive for delete to authenticated
using (has_platform_role('admin'::text));

create policy "media assets operator insert" on public.media_assets as permissive for insert to authenticated
with check (has_platform_role('admin'::text));

create policy "media assets operator update" on public.media_assets as permissive for update to authenticated
using (has_platform_role('admin'::text));

create policy "media assets public read" on public.media_assets as permissive for select to anon, authenticated
using (((is_public = true) AND (deleted_at IS NULL)));

create policy "member invitations membership admins" on public.member_invitations as permissive for all to authenticated
using (( SELECT has_permission('admin.membership.manage'::text) AS has_permission))
with check (( SELECT has_permission('admin.membership.manage'::text) AS has_permission));

create policy "members membership admin insert" on public.members as permissive for insert to authenticated
with check (has_permission('admin.membership.manage'::text));

create policy "members membership admin update" on public.members as permissive for update to authenticated
using (has_permission('admin.membership.manage'::text))
with check (has_permission('admin.membership.manage'::text));

create policy "members owner or membership admin select" on public.members as permissive for select to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) OR has_permission('admin.membership.manage'::text)));

create policy "membership applications operator read" on public.membership_applications as permissive for select to public
using ((has_platform_role('admin'::text) OR has_platform_role('moderator'::text)));

create policy "membership applications operator update" on public.membership_applications as permissive for update to public
using ((has_platform_role('admin'::text) OR has_platform_role('moderator'::text)))
with check ((has_platform_role('admin'::text) OR has_platform_role('moderator'::text)));

create policy "membership cycle memberships operator delete" on public.membership_cycle_memberships as permissive for delete to authenticated
using (has_platform_role('admin'::text));

create policy "membership cycle memberships operator insert" on public.membership_cycle_memberships as permissive for insert to authenticated
with check (has_platform_role('admin'::text));

create policy "membership cycle memberships operator update" on public.membership_cycle_memberships as permissive for update to authenticated
using (has_platform_role('admin'::text));

create policy "membership cycle memberships own or operator read" on public.membership_cycle_memberships as permissive for select to public
using (((EXISTS ( SELECT 1
   FROM members
  WHERE ((members.id = membership_cycle_memberships.member_id) AND (members.user_id = ( SELECT auth.uid() AS uid))))) OR has_platform_role('admin'::text) OR has_platform_role('moderator'::text)));

create policy "membership cycles authenticated read" on public.membership_cycles as permissive for select to public
using ((( SELECT auth.uid() AS uid) IS NOT NULL));

create policy "membership cycles operator delete" on public.membership_cycles as permissive for delete to authenticated
using (has_platform_role('admin'::text));

create policy "membership cycles operator insert" on public.membership_cycles as permissive for insert to authenticated
with check (has_platform_role('admin'::text));

create policy "membership cycles operator update" on public.membership_cycles as permissive for update to authenticated
using (has_platform_role('admin'::text));

create policy "membership id sequences membership admins read" on public.membership_id_sequences as permissive for select to authenticated
using (has_permission('admin.membership.manage'::text));

create policy "mentorship messages insert access" on public.mentorship_messages as permissive for insert to authenticated
with check (((author_user_id = auth.uid()) AND can_access_mentorship_relationship(relationship_id)));

create policy "mentorship messages select access" on public.mentorship_messages as permissive for select to authenticated
using (can_access_mentorship_relationship(relationship_id));

create policy "mentorship profiles insert self" on public.mentorship_profiles as permissive for insert to authenticated
with check (((user_id = auth.uid()) AND (member_id = current_member_id())));

create policy "mentorship profiles select access" on public.mentorship_profiles as permissive for select to authenticated
using (((user_id = auth.uid()) OR (opt_in = true) OR has_permission('portal.community.moderate'::text) OR has_permission('admin.support.manage'::text)));

create policy "mentorship profiles update self" on public.mentorship_profiles as permissive for update to authenticated
using (((user_id = auth.uid()) OR has_permission('portal.community.moderate'::text) OR has_permission('admin.support.manage'::text)))
with check ((((user_id = auth.uid()) AND (member_id = current_member_id())) OR has_permission('portal.community.moderate'::text) OR has_permission('admin.support.manage'::text)));

create policy "mentorship relationships insert participant" on public.mentorship_relationships as permissive for insert to authenticated
with check (((created_by_user_id = auth.uid()) AND (has_permission('portal.mentorship.request'::text) OR has_permission('portal.mentorship.participate'::text) OR has_permission('portal.community.moderate'::text)) AND ((member_user_id = auth.uid()) OR (alumni_user_id = auth.uid()) OR has_permission('portal.community.moderate'::text))));

create policy "mentorship relationships select access" on public.mentorship_relationships as permissive for select to authenticated
using (can_access_mentorship_relationship(id));

create policy "mentorship relationships update access" on public.mentorship_relationships as permissive for update to authenticated
using (can_access_mentorship_relationship(id))
with check (can_access_mentorship_relationship(id));

create policy "operator reports operator read" on public.operator_reports as permissive for select to authenticated
using ((( SELECT has_platform_role('admin'::text) AS has_platform_role) OR ( SELECT has_platform_role('moderator'::text) AS has_platform_role)));

create policy "operator reports operator write" on public.operator_reports as permissive for insert to authenticated
with check ((( SELECT has_platform_role('admin'::text) AS has_platform_role) OR ( SELECT has_platform_role('moderator'::text) AS has_platform_role)));

create policy "portal user settings own insert" on public.portal_user_settings as permissive for insert to authenticated
with check (((user_id = auth.uid()) AND ((member_id IS NULL) OR (member_id = current_member_id()))));

create policy "portal user settings own select" on public.portal_user_settings as permissive for select to authenticated
using ((user_id = auth.uid()));

create policy "portal user settings own update" on public.portal_user_settings as permissive for update to authenticated
using ((user_id = auth.uid()))
with check (((user_id = auth.uid()) AND ((member_id IS NULL) OR (member_id = current_member_id()))));

create policy "profile update request membership admin update" on public.profile_update_requests as permissive for update to public
using (has_permission('admin.membership.manage'::text))
with check (has_permission('admin.membership.manage'::text));

create policy "profile update request own insert" on public.profile_update_requests as permissive for insert to public
with check ((EXISTS ( SELECT 1
   FROM members
  WHERE ((members.id = profile_update_requests.member_id) AND (members.user_id = ( SELECT auth.uid() AS uid))))));

create policy "profile update request own or membership admin read" on public.profile_update_requests as permissive for select to public
using ((has_permission('admin.membership.manage'::text) OR (EXISTS ( SELECT 1
   FROM members
  WHERE ((members.id = profile_update_requests.member_id) AND (members.user_id = ( SELECT auth.uid() AS uid)))))));

create policy "profiles legacy self read" on public.profiles as permissive for select to authenticated
using ((id = ( SELECT auth.uid() AS uid)));

create policy "project_contributors operator write" on public.project_contributors as permissive for all to public
using ((has_platform_role('admin'::text) OR has_platform_role('moderator'::text)))
with check ((has_platform_role('admin'::text) OR has_platform_role('moderator'::text)));

create policy "project_contributors unified select" on public.project_contributors as permissive for select to public
using (true);

create policy "projects operator write" on public.projects as permissive for all to public
using ((has_platform_role('admin'::text) OR has_platform_role('moderator'::text)))
with check ((has_platform_role('admin'::text) OR has_platform_role('moderator'::text)));

create policy "projects unified select" on public.projects as permissive for select to public
using (true);

create policy "rbac claim versions self read" on public.rbac_user_claim_versions as permissive for select to authenticated
using ((user_id = auth.uid()));

create policy "rbac claim versions super admin read" on public.rbac_user_claim_versions as permissive for select to authenticated
using ((current_admin_role() = 'super_admin'::text));

create policy "rbac permissions admin read" on public.rbac_permissions as permissive for select to authenticated
using ((current_admin_role() = ANY (ARRAY['super_admin'::text, 'admin'::text])));

create policy "rbac role permissions admin read" on public.rbac_role_permissions as permissive for select to authenticated
using ((current_admin_role() = ANY (ARRAY['super_admin'::text, 'admin'::text])));

create policy "rbac roles admin visible read" on public.rbac_platform_roles as permissive for select to authenticated
using (((current_admin_role() = 'admin'::text) AND (is_hidden = false)));

create policy "rbac roles super admin delete" on public.rbac_platform_roles as permissive for delete to authenticated
using ((current_admin_role() = 'super_admin'::text));

create policy "rbac roles super admin insert" on public.rbac_platform_roles as permissive for insert to authenticated
with check ((current_admin_role() = 'super_admin'::text));

create policy "rbac roles super admin read" on public.rbac_platform_roles as permissive for select to authenticated
using ((current_admin_role() = 'super_admin'::text));

create policy "rbac roles super admin update" on public.rbac_platform_roles as permissive for update to authenticated
using ((current_admin_role() = 'super_admin'::text))
with check ((current_admin_role() = 'super_admin'::text));

create policy "rbac user roles admin portal delete" on public.rbac_user_platform_roles as permissive for delete to authenticated
using (((current_admin_role() = 'admin'::text) AND (EXISTS ( SELECT 1
   FROM rbac_platform_roles roles
  WHERE ((roles.id = rbac_user_platform_roles.role_id) AND (roles.scope = 'portal'::text) AND (roles.is_hidden = false))))));

create policy "rbac user roles admin portal insert" on public.rbac_user_platform_roles as permissive for insert to authenticated
with check (((current_admin_role() = 'admin'::text) AND (EXISTS ( SELECT 1
   FROM rbac_platform_roles roles
  WHERE ((roles.id = rbac_user_platform_roles.role_id) AND (roles.scope = 'portal'::text) AND (roles.is_hidden = false) AND (roles.is_assignable = true))))));

create policy "rbac user roles admin portal update" on public.rbac_user_platform_roles as permissive for update to authenticated
using (((current_admin_role() = 'admin'::text) AND (EXISTS ( SELECT 1
   FROM rbac_platform_roles roles
  WHERE ((roles.id = rbac_user_platform_roles.role_id) AND (roles.scope = 'portal'::text) AND (roles.is_hidden = false))))))
with check (((current_admin_role() = 'admin'::text) AND (EXISTS ( SELECT 1
   FROM rbac_platform_roles roles
  WHERE ((roles.id = rbac_user_platform_roles.role_id) AND (roles.scope = 'portal'::text) AND (roles.is_hidden = false) AND (roles.is_assignable = true))))));

create policy "rbac user roles admin visible read" on public.rbac_user_platform_roles as permissive for select to authenticated
using (((current_admin_role() = 'admin'::text) AND (EXISTS ( SELECT 1
   FROM rbac_platform_roles roles
  WHERE ((roles.id = rbac_user_platform_roles.role_id) AND (roles.is_hidden = false))))));

create policy "rbac user roles self read" on public.rbac_user_platform_roles as permissive for select to authenticated
using ((user_id = auth.uid()));

create policy "rbac user roles super admin delete" on public.rbac_user_platform_roles as permissive for delete to authenticated
using ((current_admin_role() = 'super_admin'::text));

create policy "rbac user roles super admin insert" on public.rbac_user_platform_roles as permissive for insert to authenticated
with check ((current_admin_role() = 'super_admin'::text));

create policy "rbac user roles super admin read" on public.rbac_user_platform_roles as permissive for select to authenticated
using ((current_admin_role() = 'super_admin'::text));

create policy "rbac user roles super admin update" on public.rbac_user_platform_roles as permissive for update to authenticated
using ((current_admin_role() = 'super_admin'::text))
with check ((current_admin_role() = 'super_admin'::text));

create policy "security events admin insert" on public.security_events as permissive for insert to authenticated
with check (((actor_user_id = auth.uid()) AND has_permission('admin.security.write'::text) AND is_aal2()));

create policy "security events admin select" on public.security_events as permissive for select to authenticated
using ((has_permission('admin.security.read'::text) OR has_permission('admin.audit.read'::text)));

create policy "security settings readable by security admins" on public.security_settings as permissive for select to authenticated
using (has_permission('admin.security.read'::text));

create policy "security settings writable by security admins" on public.security_settings as permissive for update to authenticated
using (has_permission('admin.security.write'::text))
with check ((has_permission('admin.security.write'::text) AND ((admin_totp_enforced = true) OR (current_admin_role() = 'super_admin'::text))));

create policy "support ticket events insert access" on public.support_ticket_events as permissive for insert to authenticated
with check (((COALESCE(actor_user_id, auth.uid()) = auth.uid()) AND can_access_support_ticket(ticket_id)));

create policy "support ticket events select access" on public.support_ticket_events as permissive for select to authenticated
using (can_access_support_ticket(ticket_id));

create policy "support ticket messages insert access" on public.support_ticket_messages as permissive for insert to authenticated
with check (((author_user_id = auth.uid()) AND can_access_support_ticket(ticket_id)));

create policy "support ticket messages select access" on public.support_ticket_messages as permissive for select to authenticated
using (can_access_support_ticket(ticket_id));

create policy "support tickets insert self" on public.support_tickets as permissive for insert to authenticated
with check (((opened_by_user_id = auth.uid()) AND has_permission('portal.tickets.create_self'::text) AND ((member_id IS NULL) OR (member_id = current_member_id()))));

create policy "support tickets select access" on public.support_tickets as permissive for select to authenticated
using (can_access_support_ticket(id));

create policy "support tickets update managed" on public.support_tickets as permissive for update to authenticated
using (can_manage_support_ticket(id))
with check (can_manage_support_ticket(id));

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX admin_profiles_active_idx ON public.admin_profiles USING btree (is_active, updated_at DESC);

CREATE INDEX admin_profiles_avatar_updated_by_user_id_idx ON public.admin_profiles USING btree (avatar_updated_by_user_id) WHERE (avatar_updated_by_user_id IS NOT NULL);

CREATE INDEX admin_profiles_created_by_user_id_idx ON public.admin_profiles USING btree (created_by_user_id) WHERE (created_by_user_id IS NOT NULL);

CREATE INDEX admin_profiles_email_idx ON public.admin_profiles USING btree (email) WHERE (email IS NOT NULL);

CREATE INDEX advisor_profiles_current_speech_idx ON public.advisor_profiles USING btree (advisor_type, sort_order) WHERE ((is_current = true) AND (is_public = true) AND (speech IS NOT NULL) AND (btrim(speech) <> ''::text));

CREATE UNIQUE INDEX advisor_profiles_one_public_current_chief_idx ON public.advisor_profiles USING btree (advisor_type) WHERE ((advisor_type = 'main_advisor'::text) AND (is_public = true) AND (is_current = true));

CREATE UNIQUE INDEX advisor_profiles_one_public_current_moderator_idx ON public.advisor_profiles USING btree (advisor_type) WHERE ((advisor_type = 'moderator_mentor'::text) AND (is_public = true) AND (is_current = true));

CREATE INDEX advisor_profiles_public_current_idx ON public.advisor_profiles USING btree (is_public, is_current, sort_order, full_name);

CREATE INDEX advisor_profiles_public_history_idx ON public.advisor_profiles USING btree (is_public, advisor_type, left_on DESC, joined_on DESC) WHERE (is_public = true);

CREATE INDEX advisor_profiles_type_current_idx ON public.advisor_profiles USING btree (advisor_type, is_current, is_public, sort_order, full_name);

CREATE INDEX advisor_profiles_user_idx ON public.advisor_profiles USING btree (user_id) WHERE (user_id IS NOT NULL);

CREATE INDEX audit_events_actor_user_id_idx ON public.audit_events USING btree (actor_user_id);

CREATE INDEX blog_review_events_post_created_idx ON public.blog_review_events USING btree (post_id, created_at DESC);

CREATE INDEX bulk_operation_rows_operation_status_idx ON public.bulk_operation_rows USING btree (operation_id, status, row_number);

CREATE INDEX bulk_operations_committed_by_user_id_idx ON public.bulk_operations USING btree (committed_by_user_id) WHERE (committed_by_user_id IS NOT NULL);

CREATE INDEX bulk_operations_created_by_idx ON public.bulk_operations USING btree (created_by_user_id, created_at DESC);

CREATE INDEX bulk_operations_status_idx ON public.bulk_operations USING btree (status, created_at DESC);

CREATE INDEX cert_import_batches_created_by_user_id_idx ON public.certificate_import_batches USING btree (created_by_user_id);

CREATE INDEX committee_assignments_created_by_idx ON public.committee_assignments USING btree (created_by_user_id);

CREATE INDEX committee_assignments_member_idx ON public.committee_assignments USING btree (member_id, status);

CREATE INDEX committee_assignments_public_term_idx ON public.committee_assignments USING btree (term_id, is_public, status, sort_order);

CREATE INDEX committee_assignments_role_id_idx ON public.committee_assignments USING btree (role_id);

CREATE INDEX committee_assignments_term_idx ON public.committee_assignments USING btree (term_id, sort_order, created_at);

CREATE INDEX committee_roles_group_sort_idx ON public.committee_roles USING btree (role_group, sort_order, code);

CREATE INDEX committee_terms_created_by_idx ON public.committee_terms USING btree (created_by_user_id);

CREATE INDEX committee_terms_kind_current_idx ON public.committee_terms USING btree (term_kind, is_current, starts_on DESC);

CREATE UNIQUE INDEX committee_terms_one_current_executive_idx ON public.committee_terms USING btree (is_current) WHERE ((is_current = true) AND (term_kind = 'executive'::text));

CREATE INDEX committee_terms_status_idx ON public.committee_terms USING btree (status, starts_on DESC);

CREATE INDEX contact_settings_group_sort_idx ON public.contact_settings USING btree (group_name, sort_order, key);

CREATE INDEX contact_settings_public_idx ON public.contact_settings USING btree (is_public, group_name, sort_order) WHERE (is_public = true);

CREATE INDEX content_pages_created_by_idx ON public.content_pages USING btree (created_by_user_id);

CREATE INDEX content_posts_author_advisor_idx ON public.content_posts USING btree (author_advisor_profile_id, content_type, status, updated_at DESC) WHERE (author_advisor_profile_id IS NOT NULL);

CREATE INDEX content_posts_author_member_idx ON public.content_posts USING btree (author_member_id, content_type, status, updated_at DESC);

CREATE INDEX content_posts_author_review_state_idx ON public.content_posts USING btree (author_member_id, content_type, status, updated_at DESC);

CREATE INDEX content_posts_created_by_idx ON public.content_posts USING btree (created_by_user_id);

CREATE INDEX content_posts_listing_idx ON public.content_posts USING btree (content_type, status, published_at DESC NULLS LAST, created_at DESC);

CREATE INDEX content_posts_media_asset_id_idx ON public.content_posts USING btree (media_asset_id);

CREATE INDEX content_posts_pending_review_idx ON public.content_posts USING btree (content_type, status, submitted_at DESC NULLS LAST, updated_at DESC);

CREATE INDEX content_posts_review_queue_idx ON public.content_posts USING btree (content_type, status, submitted_at DESC NULLS LAST, updated_at DESC);

CREATE INDEX content_posts_reviewed_by_user_id_idx ON public.content_posts USING btree (reviewed_by_user_id);

CREATE INDEX dev_profiles_created_by_user_id_idx ON public.developer_profiles USING btree (created_by_user_id);

CREATE INDEX dev_profiles_media_asset_id_idx ON public.developer_profiles USING btree (media_asset_id);

CREATE INDEX developer_profiles_status_idx ON public.developer_profiles USING btree (status, sort_order, created_at DESC);

CREATE UNIQUE INDEX event_registrations_active_email_per_event_idx ON public.event_registrations USING btree (event_id, lower((registrant_email)::text)) WHERE ((event_id IS NOT NULL) AND (cancelled_at IS NULL));

CREATE INDEX event_registrations_checkin_idx ON public.event_registrations USING btree (event_post_id, checked_in_at);

CREATE INDEX event_registrations_code_idx ON public.event_registrations USING btree (registration_code);

CREATE INDEX event_registrations_email_idx ON public.event_registrations USING btree (registrant_email);

CREATE INDEX event_registrations_event_id_cancelled_at_idx ON public.event_registrations USING btree (event_id, cancelled_at);

CREATE INDEX event_registrations_event_id_idx ON public.event_registrations USING btree (event_id);

CREATE INDEX event_registrations_event_post_id_idx ON public.event_registrations USING btree (event_post_id);

CREATE INDEX events_category_status_starts_at_idx ON public.events USING btree (category, status, starts_at DESC);

CREATE INDEX events_published_starts_at_idx ON public.events USING btree (published_at DESC NULLS LAST, starts_at DESC) WHERE (status = 'published'::text);

CREATE INDEX events_starts_at_idx ON public.events USING btree (starts_at DESC);

CREATE INDEX events_status_starts_at_idx ON public.events USING btree (status, starts_at DESC);

CREATE INDEX gallery_album_items_album_order_idx ON public.gallery_album_items USING btree (album_id, status, deleted_at, sort_order, id);

CREATE INDEX gallery_album_items_media_asset_id_idx ON public.gallery_album_items USING btree (media_asset_id);

CREATE UNIQUE INDEX gallery_album_items_single_cover_idx ON public.gallery_album_items USING btree (album_id) WHERE ((is_cover = true) AND (deleted_at IS NULL));

CREATE INDEX gallery_albums_public_idx ON public.gallery_albums USING btree (status, deleted_at, featured DESC, year DESC, month DESC, updated_at DESC);

CREATE INDEX gallery_albums_search_idx ON public.gallery_albums USING gin (to_tsvector('english'::regconfig, ((((((((COALESCE(title, ''::text) || ' '::text) || COALESCE(event_name, ''::text)) || ' '::text) || COALESCE(description, ''::text)) || ' '::text) || COALESCE(category, ''::text)) || ' '::text) || COALESCE((year)::text, ''::text))));

CREATE INDEX gallery_albums_year_category_idx ON public.gallery_albums USING btree (year DESC, category, status) WHERE (deleted_at IS NULL);

CREATE INDEX gallery_entries_created_by_user_id_idx ON public.gallery_entries USING btree (created_by_user_id);

CREATE INDEX gallery_entries_media_asset_id_idx ON public.gallery_entries USING btree (media_asset_id);

CREATE INDEX gallery_entries_status_idx ON public.gallery_entries USING btree (status, sort_order, created_at DESC);

CREATE INDEX idx_advisor_profiles_is_current ON public.advisor_profiles USING btree (is_current);

CREATE INDEX invitation_batches_created_by_user_id_idx ON public.invitation_batches USING btree (created_by_user_id);

CREATE INDEX invitation_email_deliveries_invitation_idx ON public.invitation_email_deliveries USING btree (invitation_id, created_at DESC);

CREATE INDEX invitation_email_deliveries_status_idx ON public.invitation_email_deliveries USING btree (status, created_at DESC);

CREATE INDEX media_assets_created_by_user_id_idx ON public.media_assets USING btree (created_by_user_id);

CREATE INDEX media_assets_deleted_at_idx ON public.media_assets USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);

CREATE INDEX member_invitations_active_workspace_idx ON public.member_invitations USING btree (expires_at, created_at DESC) WHERE ((is_active = true) AND (revoked_at IS NULL));

CREATE INDEX member_invitations_batch_idx ON public.member_invitations USING btree (batch_id, created_at DESC) WHERE (batch_id IS NOT NULL);

CREATE INDEX member_invitations_created_by_user_id_idx ON public.member_invitations USING btree (created_by_user_id);

CREATE INDEX member_invitations_delivery_status_idx ON public.member_invitations USING btree (delivery_status, created_at DESC);

CREATE INDEX member_invitations_member_idx ON public.member_invitations USING btree (member_id, expires_at DESC);

CREATE INDEX member_invitations_member_workspace_idx ON public.member_invitations USING btree (member_id, created_at DESC);

CREATE INDEX members_avatar_updated_by_user_id_idx ON public.members USING btree (avatar_updated_by_user_id) WHERE (avatar_updated_by_user_id IS NOT NULL);

CREATE UNIQUE INDEX members_email_unique ON public.members USING btree (email) WHERE (email IS NOT NULL);

CREATE INDEX members_lifecycle_changed_by_user_id_idx ON public.members USING btree (lifecycle_changed_by_user_id) WHERE (lifecycle_changed_by_user_id IS NOT NULL);

CREATE INDEX members_lifecycle_status_idx ON public.members USING btree (lifecycle_status, portal_access_status, updated_at DESC);

CREATE INDEX members_member_type_idx ON public.members USING btree (member_type);

CREATE INDEX members_public_directory_idx ON public.members USING btree (member_type, lifecycle_status, portal_access_status, full_name) WHERE ((lifecycle_status <> 'deleted'::text) AND (portal_access_status = 'active'::text) AND (upper((jnuits_id)::text) !~ '^JNUITS-ADMIN-'::text));

CREATE INDEX members_user_id_idx ON public.members USING btree (user_id);

CREATE INDEX members_user_id_not_null_idx ON public.members USING btree (user_id) WHERE (user_id IS NOT NULL);

CREATE INDEX membership_applications_processed_member_idx ON public.membership_applications USING btree (processed_member_id) WHERE (processed_member_id IS NOT NULL);

CREATE INDEX membership_applications_status_created_idx ON public.membership_applications USING btree (status, created_at DESC);

CREATE INDEX membership_apps_dept_code_idx ON public.membership_applications USING btree (department_code);

CREATE INDEX membership_apps_invitation_id_idx ON public.membership_applications USING btree (invitation_id);

CREATE INDEX membership_apps_reviewed_by_idx ON public.membership_applications USING btree (reviewed_by_user_id);

CREATE INDEX membership_cycle_memberships_created_by_idx ON public.membership_cycle_memberships USING btree (created_by_user_id);

CREATE INDEX membership_cycle_memberships_member_idx ON public.membership_cycle_memberships USING btree (member_id, state, updated_at DESC);

CREATE INDEX membership_cycles_created_by_idx ON public.membership_cycles USING btree (created_by_user_id);

CREATE INDEX membership_lifecycle_events_created_by_idx ON public.membership_lifecycle_events USING btree (created_by_user_id);

CREATE INDEX membership_lifecycle_events_member_idx ON public.membership_lifecycle_events USING btree (member_id, occurred_at DESC);

CREATE INDEX mentorship_messages_relationship_created_idx ON public.mentorship_messages USING btree (relationship_id, created_at);

CREATE UNIQUE INDEX mentorship_relationships_active_pair_idx ON public.mentorship_relationships USING btree (member_user_id, alumni_user_id) WHERE ((status = ANY (ARRAY['requested'::text, 'active'::text])) AND (closed_at IS NULL));

CREATE INDEX mentorship_relationships_alumni_idx ON public.mentorship_relationships USING btree (alumni_user_id, created_at DESC);

CREATE INDEX mentorship_relationships_member_idx ON public.mentorship_relationships USING btree (member_user_id, created_at DESC);

CREATE INDEX operator_reports_created_by_idx ON public.operator_reports USING btree (created_by_user_id);

CREATE INDEX profile_update_requests_member_idx ON public.profile_update_requests USING btree (member_id, requested_at DESC);

CREATE INDEX profile_update_requests_member_status_requested_idx ON public.profile_update_requests USING btree (member_id, status, requested_at DESC);

CREATE INDEX profile_update_requests_reviewed_at_idx ON public.profile_update_requests USING btree (reviewed_at DESC) WHERE (reviewed_at IS NOT NULL);

CREATE INDEX profile_update_requests_reviewed_by_idx ON public.profile_update_requests USING btree (reviewed_by_user_id);

CREATE INDEX profile_update_requests_submitter_requested_idx ON public.profile_update_requests USING btree (submitted_by_user_id, requested_at DESC) WHERE (submitted_by_user_id IS NOT NULL);

CREATE INDEX profile_update_requests_type_status_requested_idx ON public.profile_update_requests USING btree (request_type, status, requested_at DESC);

CREATE INDEX profiles_department_code_idx ON public.profiles USING btree (department_code);

CREATE UNIQUE INDEX profiles_email_unique ON public.profiles USING btree (email) WHERE (email IS NOT NULL);

CREATE INDEX project_contributors_member_idx ON public.project_contributors USING btree (member_id);

CREATE INDEX project_contributors_project_idx ON public.project_contributors USING btree (project_id);

CREATE INDEX projects_category_status_idx ON public.projects USING btree (category, status);

CREATE INDEX projects_featured_idx ON public.projects USING btree (is_featured) WHERE (is_featured = true);

CREATE INDEX projects_status_created_idx ON public.projects USING btree (status, created_at DESC);

CREATE INDEX rbac_role_permissions_role_permission_idx ON public.rbac_role_permissions USING btree (role_id, permission_code);

CREATE INDEX rbac_user_platform_roles_granted_by_idx ON public.rbac_user_platform_roles USING btree (granted_by);

CREATE INDEX rbac_user_platform_roles_role_id_idx ON public.rbac_user_platform_roles USING btree (role_id);

CREATE UNIQUE INDEX rbac_user_role_active_scope_unique ON public.rbac_user_platform_roles USING btree (user_id, scope) WHERE (revoked_at IS NULL);

CREATE UNIQUE INDEX rbac_user_role_active_unique ON public.rbac_user_platform_roles USING btree (user_id, role_id) WHERE (revoked_at IS NULL);

CREATE INDEX rbac_user_roles_user_idx ON public.rbac_user_platform_roles USING btree (user_id, revoked_at);

CREATE INDEX rbac_user_roles_user_scope_role_idx ON public.rbac_user_platform_roles USING btree (user_id, revoked_at, scope, role_id);

CREATE INDEX security_events_actor_created_idx ON public.security_events USING btree (actor_user_id, created_at DESC);

CREATE INDEX security_events_target_created_idx ON public.security_events USING btree (target_user_id, created_at DESC);

CREATE INDEX support_ticket_events_ticket_created_idx ON public.support_ticket_events USING btree (ticket_id, created_at);

CREATE INDEX support_ticket_messages_ticket_created_idx ON public.support_ticket_messages USING btree (ticket_id, created_at);

CREATE INDEX support_tickets_assigned_idx ON public.support_tickets USING btree (assigned_to_user_id, status, created_at DESC);

CREATE INDEX support_tickets_audience_status_idx ON public.support_tickets USING btree (audience_scope, status, created_at DESC);

CREATE INDEX support_tickets_opened_by_idx ON public.support_tickets USING btree (opened_by_user_id, created_at DESC);

-- ============================================================================
-- Table Grants
-- ============================================================================

grant delete, insert, references, select, trigger, truncate, update on table public.admin_profiles to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.admin_profiles to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.admin_profiles to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.advisor_profiles to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.advisor_profiles to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.advisor_profiles to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.audit_events to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.audit_events to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.audit_events to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.blog_review_events to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.blog_review_events to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.blog_review_events to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.bulk_operation_rows to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.bulk_operation_rows to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.bulk_operation_rows to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.bulk_operations to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.bulk_operations to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.bulk_operations to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.certificate_import_batches to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.certificate_import_batches to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.certificate_import_batches to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.certificates to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.certificates to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.certificates to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.certificates_import_staging to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.certificates_import_staging to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.certificates_import_staging to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.committee_assignments to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.committee_assignments to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.committee_assignments to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.committee_roles to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.committee_roles to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.committee_roles to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.committee_terms to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.committee_terms to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.committee_terms to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.contact_settings to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.contact_settings to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.contact_settings to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.content_pages to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.content_pages to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.content_pages to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.content_posts to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.content_posts to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.content_posts to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.departments to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.departments to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.departments to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.developer_profiles to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.developer_profiles to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.developer_profiles to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.event_registrations to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.event_registrations to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.event_registrations to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.events to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.events to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.events to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.gallery_album_items to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.gallery_album_items to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.gallery_album_items to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.gallery_albums to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.gallery_albums to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.gallery_albums to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.gallery_entries to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.gallery_entries to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.gallery_entries to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.invitation_batches to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.invitation_batches to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.invitation_batches to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.invitation_email_deliveries to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.invitation_email_deliveries to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.invitation_email_deliveries to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.media_assets to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.media_assets to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.media_assets to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.member_invitations to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.member_invitations to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.member_invitations to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.members to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.members to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.members to service_role;

grant delete, references, select, trigger, truncate, update on table public.membership_applications to anon;

grant delete, references, select, trigger, truncate, update on table public.membership_applications to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.membership_applications to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.membership_cycle_memberships to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.membership_cycle_memberships to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.membership_cycle_memberships to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.membership_cycles to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.membership_cycles to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.membership_cycles to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.membership_id_sequences to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.membership_id_sequences to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.membership_id_sequences to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.membership_lifecycle_events to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.membership_lifecycle_events to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.membership_lifecycle_events to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.mentorship_messages to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.mentorship_messages to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.mentorship_messages to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.mentorship_profiles to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.mentorship_profiles to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.mentorship_profiles to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.mentorship_relationships to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.mentorship_relationships to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.mentorship_relationships to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.operator_reports to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.operator_reports to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.operator_reports to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.portal_user_settings to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.portal_user_settings to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.portal_user_settings to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.profile_update_requests to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.profile_update_requests to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.profile_update_requests to service_role;

grant references, select, trigger, truncate on table public.profiles to anon;

grant references, select, trigger, truncate on table public.profiles to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.profiles to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.project_contributors to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.project_contributors to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.project_contributors to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.projects to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.projects to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.projects to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.rbac_permissions to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.rbac_permissions to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.rbac_permissions to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.rbac_platform_roles to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.rbac_platform_roles to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.rbac_platform_roles to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.rbac_role_permissions to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.rbac_role_permissions to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.rbac_role_permissions to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.rbac_user_claim_versions to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.rbac_user_claim_versions to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.rbac_user_claim_versions to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.rbac_user_platform_roles to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.rbac_user_platform_roles to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.rbac_user_platform_roles to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.security_events to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.security_events to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.security_events to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.security_settings to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.security_settings to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.security_settings to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.support_ticket_events to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.support_ticket_events to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.support_ticket_events to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.support_ticket_messages to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.support_ticket_messages to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.support_ticket_messages to service_role;

grant delete, insert, references, select, trigger, truncate, update on table public.support_tickets to anon;

grant delete, insert, references, select, trigger, truncate, update on table public.support_tickets to authenticated;

grant delete, insert, references, select, trigger, truncate, update on table public.support_tickets to service_role;

-- ============================================================================
-- Sequence Grants
-- ============================================================================

grant usage, select, update on sequence public.advisor_ca_id_seq to anon;

grant usage, select, update on sequence public.advisor_ca_id_seq to authenticated;

grant usage, select, update on sequence public.advisor_ca_id_seq to service_role;

grant usage, select, update on sequence public.advisor_mod_id_seq to anon;

grant usage, select, update on sequence public.advisor_mod_id_seq to authenticated;

grant usage, select, update on sequence public.advisor_mod_id_seq to service_role;

grant usage, select, update on sequence public.advisor_ra_id_seq to anon;

grant usage, select, update on sequence public.advisor_ra_id_seq to authenticated;

grant usage, select, update on sequence public.advisor_ra_id_seq to service_role;

-- ============================================================================
-- Function Grants
-- ============================================================================

grant execute on function public.allocate_membership_id(year_block text) to anon;

grant execute on function public.allocate_membership_id(year_block text) to authenticated;

grant execute on function public.allocate_membership_id(year_block text) to service_role;

grant execute on function public.assign_advisor_jnuits_id() to anon;

grant execute on function public.assign_advisor_jnuits_id() to authenticated;

grant execute on function public.assign_advisor_jnuits_id() to service_role;

grant execute on function public.bump_claim_version_from_member_link() to anon;

grant execute on function public.bump_claim_version_from_member_link() to authenticated;

grant execute on function public.bump_claim_version_from_member_link() to service_role;

grant execute on function public.bump_claim_version_from_role_assignment() to anon;

grant execute on function public.bump_claim_version_from_role_assignment() to authenticated;

grant execute on function public.bump_claim_version_from_role_assignment() to service_role;

grant execute on function public.bump_user_claim_version(target_user_id uuid) to anon;

grant execute on function public.bump_user_claim_version(target_user_id uuid) to authenticated;

grant execute on function public.bump_user_claim_version(target_user_id uuid) to service_role;

grant execute on function public.can_access_mentorship_relationship(target_relationship_id uuid) to anon;

grant execute on function public.can_access_mentorship_relationship(target_relationship_id uuid) to authenticated;

grant execute on function public.can_access_mentorship_relationship(target_relationship_id uuid) to service_role;

grant execute on function public.can_access_support_ticket(target_ticket_id uuid) to anon;

grant execute on function public.can_access_support_ticket(target_ticket_id uuid) to authenticated;

grant execute on function public.can_access_support_ticket(target_ticket_id uuid) to service_role;

grant execute on function public.can_manage_support_ticket(target_ticket_id uuid) to anon;

grant execute on function public.can_manage_support_ticket(target_ticket_id uuid) to authenticated;

grant execute on function public.can_manage_support_ticket(target_ticket_id uuid) to service_role;

grant execute on function public.commit_bulk_membership_operation(target_operation_id uuid) to anon;

grant execute on function public.commit_bulk_membership_operation(target_operation_id uuid) to authenticated;

grant execute on function public.commit_bulk_membership_operation(target_operation_id uuid) to service_role;

grant execute on function public.current_admin_role() to anon;

grant execute on function public.current_admin_role() to authenticated;

grant execute on function public.current_admin_role() to service_role;

grant execute on function public.current_member_id() to anon;

grant execute on function public.current_member_id() to authenticated;

grant execute on function public.current_member_id() to service_role;

grant execute on function public.current_member_type() to anon;

grant execute on function public.current_member_type() to authenticated;

grant execute on function public.current_member_type() to service_role;

grant execute on function public.current_portal_role() to anon;

grant execute on function public.current_portal_role() to authenticated;

grant execute on function public.current_portal_role() to service_role;

grant execute on function public.current_rbac_claims_snapshot() to anon;

grant execute on function public.current_rbac_claims_snapshot() to authenticated;

grant execute on function public.current_rbac_claims_snapshot() to service_role;

grant execute on function public.finalize_member_invitation_claim(target_user_id uuid, target_email text, target_member_id uuid, target_invitation_id uuid) to service_role;

grant execute on function public.format_jnuits_id(raw_id text) to anon;

grant execute on function public.format_jnuits_id(raw_id text) to authenticated;

grant execute on function public.format_jnuits_id(raw_id text) to service_role;

grant execute on function public.handle_new_auth_user() to anon;

grant execute on function public.handle_new_auth_user() to authenticated;

grant execute on function public.handle_new_auth_user() to service_role;

grant execute on function public.has_permission(requested_permission text) to anon;

grant execute on function public.has_permission(requested_permission text) to authenticated;

grant execute on function public.has_permission(requested_permission text) to service_role;

grant execute on function public.has_platform_role(role_code text) to anon;

grant execute on function public.has_platform_role(role_code text) to authenticated;

grant execute on function public.has_platform_role(role_code text) to service_role;

grant execute on function public.is_aal2() to anon;

grant execute on function public.is_aal2() to authenticated;

grant execute on function public.is_aal2() to service_role;

grant execute on function public.is_admin_totp_enforced() to anon;

grant execute on function public.is_admin_totp_enforced() to authenticated;

grant execute on function public.is_admin_totp_enforced() to service_role;

grant execute on function public.is_super_admin() to anon;

grant execute on function public.is_super_admin() to authenticated;

grant execute on function public.is_super_admin() to service_role;

grant execute on function public.is_super_admin_user(target_user_id uuid) to anon;

grant execute on function public.is_super_admin_user(target_user_id uuid) to authenticated;

grant execute on function public.is_super_admin_user(target_user_id uuid) to service_role;

grant execute on function public.jnuits_custom_access_token_hook(event jsonb) to service_role;

grant execute on function public.log_auth_user_security_event() to anon;

grant execute on function public.log_auth_user_security_event() to authenticated;

grant execute on function public.log_auth_user_security_event() to service_role;

grant execute on function public.log_member_identity_security_event() to anon;

grant execute on function public.log_member_identity_security_event() to authenticated;

grant execute on function public.log_member_identity_security_event() to service_role;

grant execute on function public.log_mfa_factor_security_event() to anon;

grant execute on function public.log_mfa_factor_security_event() to authenticated;

grant execute on function public.log_mfa_factor_security_event() to service_role;

grant execute on function public.log_rbac_assignment_security_event() to anon;

grant execute on function public.log_rbac_assignment_security_event() to authenticated;

grant execute on function public.log_rbac_assignment_security_event() to service_role;

grant execute on function public.log_security_settings_security_event() to anon;

grant execute on function public.log_security_settings_security_event() to authenticated;

grant execute on function public.log_security_settings_security_event() to service_role;

grant execute on function public.normalize_jnuits_id(raw_id text) to anon;

grant execute on function public.normalize_jnuits_id(raw_id text) to authenticated;

grant execute on function public.normalize_jnuits_id(raw_id text) to service_role;

grant execute on function public.preview_bulk_membership_operation(target_operation_id uuid) to anon;

grant execute on function public.preview_bulk_membership_operation(target_operation_id uuid) to authenticated;

grant execute on function public.preview_bulk_membership_operation(target_operation_id uuid) to service_role;

grant execute on function public.rls_auto_enable() to anon;

grant execute on function public.rls_auto_enable() to authenticated;

grant execute on function public.rls_auto_enable() to service_role;

grant execute on function public.set_current_timestamp_updated_at() to anon;

grant execute on function public.set_current_timestamp_updated_at() to authenticated;

grant execute on function public.set_current_timestamp_updated_at() to service_role;

grant execute on function public.set_member_lifecycle_status(target_member_id uuid, next_lifecycle_status text, next_portal_access_status text, reason text) to anon;

grant execute on function public.set_member_lifecycle_status(target_member_id uuid, next_lifecycle_status text, next_portal_access_status text, reason text) to authenticated;

grant execute on function public.set_member_lifecycle_status(target_member_id uuid, next_lifecycle_status text, next_portal_access_status text, reason text) to service_role;

grant execute on function public.sync_membership_id_sequence_from_member() to anon;

grant execute on function public.sync_membership_id_sequence_from_member() to authenticated;

grant execute on function public.sync_membership_id_sequence_from_member() to service_role;

grant execute on function public.sync_user_platform_role_scope() to anon;

grant execute on function public.sync_user_platform_role_scope() to authenticated;

grant execute on function public.sync_user_platform_role_scope() to service_role;

grant execute on function public.update_advisor_speech_timestamp() to anon;

grant execute on function public.update_advisor_speech_timestamp() to authenticated;

grant execute on function public.update_advisor_speech_timestamp() to service_role;

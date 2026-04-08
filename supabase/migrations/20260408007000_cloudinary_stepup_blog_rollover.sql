alter table public.content_posts
  drop constraint if exists content_posts_status_check;

alter table public.content_posts
  add constraint content_posts_status_check
  check (status in ('draft', 'submitted', 'published', 'archived'));

alter table public.content_posts
  add column if not exists author_member_id uuid null references public.members (id) on delete set null,
  add column if not exists submitted_at timestamptz null,
  add column if not exists reviewed_at timestamptz null,
  add column if not exists reviewed_by_user_id uuid null references auth.users (id) on delete set null,
  add column if not exists review_note text null;

create index if not exists content_posts_author_member_idx
  on public.content_posts (author_member_id, content_type, status, updated_at desc);

create index if not exists content_posts_review_queue_idx
  on public.content_posts (content_type, status, submitted_at desc nulls last, updated_at desc);

alter table public.committee_terms
  add column if not exists rollover_source_term_id uuid null references public.committee_terms (id) on delete set null;

alter table public.committee_assignments
  add column if not exists rollover_source_assignment_id uuid null references public.committee_assignments (id) on delete set null;

create index if not exists committee_terms_rollover_source_idx
  on public.committee_terms (rollover_source_term_id, starts_on desc);

create index if not exists committee_assignments_rollover_source_idx
  on public.committee_assignments (rollover_source_assignment_id, term_id, sort_order);

alter table public.operator_reports
  drop constraint if exists operator_reports_report_type_check;

alter table public.operator_reports
  add constraint operator_reports_report_type_check
  check (
    report_type in (
      'membership_overview',
      'committee_roster',
      'content_inventory',
      'reconciliation_snapshot',
      'workplace_moderation',
      'csv_onboarding',
      'membership_reconciliation',
      'committee_rollover'
    )
  );

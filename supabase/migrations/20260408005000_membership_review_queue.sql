alter table public.membership_applications
  add column if not exists review_note text null,
  add column if not exists reviewed_at timestamptz null,
  add column if not exists reviewed_by_user_id uuid null references auth.users (id) on delete set null,
  add column if not exists processed_member_id uuid null references public.members (id) on delete set null,
  add column if not exists invitation_id uuid null references public.member_invitations (id) on delete set null;

create index if not exists membership_applications_status_created_idx
  on public.membership_applications (status, created_at desc);

create index if not exists membership_applications_reviewed_idx
  on public.membership_applications (reviewed_at desc)
  where reviewed_at is not null;

create index if not exists membership_applications_processed_member_idx
  on public.membership_applications (processed_member_id)
  where processed_member_id is not null;

revoke insert on public.membership_applications from anon, authenticated;

drop policy if exists "membership applications open insert" on public.membership_applications;

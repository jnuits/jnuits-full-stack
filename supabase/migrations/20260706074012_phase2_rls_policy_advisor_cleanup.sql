begin;

-- Keep the rate-limit table private while avoiding an RLS-enabled/no-policy
-- advisor warning. No anon/authenticated grants exist for this table.
drop policy if exists "security rate limits service role private" on public.security_rate_limits;
create policy "security rate limits service role private"
on public.security_rate_limits
for all
to service_role
using (true)
with check (true);

notify pgrst, 'reload schema';

commit;

begin;

-- Later view recreation migrations granted SELECT but did not revoke broader
-- privileges that existed from earlier public-schema defaults. The certificate
-- verification view is read-only API surface, so public roles should have only
-- SELECT on the curated projection.
revoke all privileges on table public.public_certificates
from public, anon, authenticated;

grant select on table public.public_certificates to anon, authenticated;

select pg_notify('pgrst', 'reload schema');

commit;
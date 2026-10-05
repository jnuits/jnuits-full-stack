-- Bounded archive metadata: no notice bodies cross the summary boundary.
begin;
create or replace function public.get_public_blog_categories()
returns text[]
language sql stable security invoker set search_path = ''
as $facets$
  select coalesce(array_agg(distinct coalesce(category,'Blog') order by coalesce(category,'Blog')),array[]::text[])
  from public.content_posts where content_type='blog' and status='published';
$facets$;
revoke all on function public.get_public_blog_categories() from public;
grant execute on function public.get_public_blog_categories() to anon, authenticated, service_role;

create or replace function public.get_admin_notice_summary()
returns jsonb
language sql stable security invoker set search_path = ''
as $summary$
  select jsonb_build_object(
    'categories',coalesce(array_agg(distinct coalesce(category,'Notice') order by coalesce(category,'Notice')),array[]::text[]),
    'metrics',jsonb_build_object('total',count(*),'published',count(*) filter(where status='published'),
      'drafts',count(*) filter(where status='draft'),'archived',count(*) filter(where status='archived')))
  from public.content_posts where content_type='notice';
$summary$;
revoke all on function public.get_admin_notice_summary() from public, anon, authenticated;
grant execute on function public.get_admin_notice_summary() to service_role;

create index if not exists content_posts_public_blog_archive_idx
  on public.content_posts(published_at desc nulls last,id desc)
  where content_type='blog' and status='published';
create index if not exists content_posts_admin_notice_archive_idx
  on public.content_posts(status,published_at desc nulls last,created_at desc,id desc)
  where content_type='notice';
commit;

-- Disposable fixtures only; production records and grants are never changed.
begin;
delete from public.content_posts;
insert into public.content_posts(content_type,slug,title,category,status,body)
select 'blog','audit-blog-'||i,'Fictional blog '||i,case when i<=25 then 'Tutorial' else 'News' end,'published',repeat('x',4096)
from generate_series(1,40) i;
insert into public.content_posts(content_type,slug,title,category,status,body)
select 'notice','audit-notice-'||i,'Fictional notice '||i,case when i<=25 then 'Tutorial' else 'News' end,
case when i<=25 then 'published' when i<=28 then 'draft' else 'archived' end,repeat('x',4096)
from generate_series(1,30) i;
insert into public.content_posts(content_type,slug,title,category,status) values('blog','audit-draft','Private draft','Private','draft');

do $verify$
declare summary jsonb; categories text[];
begin
  if has_function_privilege('anon','public.get_admin_notice_summary()','EXECUTE')
    or has_function_privilege('authenticated','public.get_admin_notice_summary()','EXECUTE') then
    raise exception 'Private notice summary callable by a browser role';
  end if;
  set local role service_role;
  summary := public.get_admin_notice_summary();
  reset role;
  if summary->'metrics' <> '{"total":30,"published":25,"drafts":3,"archived":2}'::jsonb
    or summary->'categories' <> '["News","Tutorial"]'::jsonb then
    raise exception 'Notice global summary incorrect: %',summary;
  end if;
  set local role anon;
  categories := public.get_public_blog_categories();
  reset role;
  if categories <> array['News','Tutorial'] then raise exception 'Public blog facets leak drafts or omit categories'; end if;
end;
$verify$;
rollback;

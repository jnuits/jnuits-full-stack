-- Disposable replay only. Fictional fixtures; all changes roll back.
begin;
do $audit_security$
declare
  failures text[] := array[]::text[];
  browser_role text; privilege_name text; offender text;
  portal_id uuid := extensions.gen_random_uuid();
  ordinary_id uuid := extensions.gen_random_uuid();
  manager_id uuid := extensions.gen_random_uuid();
  super_id uuid := extensions.gen_random_uuid();
  actor uuid; role_code text; result boolean; visible integer;
begin
  foreach browser_role in array array['anon','authenticated'] loop
    foreach privilege_name in array array['TRUNCATE','TRIGGER','REFERENCES','MAINTAIN'] loop
      select string_agg(c.relname,', ' order by c.relname) into offender
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p')
        and has_table_privilege(browser_role,c.oid,privilege_name);
      if offender is not null then
        failures := array_append(failures,browser_role||' retains '||privilege_name||': '||offender);
      end if;
    end loop;
  end loop;

  -- Future project-owned objects require explicit browser grants.
  create table public._jnuits_audit_default_probe(id integer);
  foreach browser_role in array array['anon','authenticated'] loop
    foreach privilege_name in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES','MAINTAIN'] loop
      if has_table_privilege(browser_role,'public._jnuits_audit_default_probe',privilege_name) then
        failures := array_append(failures,'new project table implicitly grants '||browser_role||' '||privilege_name);
      end if;
    end loop;
  end loop;

  insert into auth.users(id,email,email_confirmed_at)
  values(portal_id,'audit-portal@local.invalid',now()),
    (ordinary_id,'audit-editor@local.invalid',now()),
    (manager_id,'audit-manager@local.invalid',now()),
    (super_id,'audit-super@local.invalid',now());
  insert into public.rbac_user_platform_roles(user_id,role_id,scope,note)
    select x.u,r.id,r.scope,'Disposable audit regression'
    from (values (ordinary_id,'content_editor'),(manager_id,'admin'),(super_id,'super_admin')) x(u,code)
    join public.rbac_platform_roles r on r.code=x.code and r.scope='admin';
  insert into public.admin_profiles(user_id,admin_code,display_name,is_active,status)
    values(ordinary_id,'AUDIT-EDITOR','Fictional editor',true,'active'),
      (manager_id,'AUDIT-MANAGER','Fictional manager',true,'active'),
      (super_id,'AUDIT-SUPER','Fictional super',true,'active');

  -- Existing admin_profiles may be service-only. Exercise its retained RLS
  -- under a disposable, rollback-only capability without widening production ACLs.
  grant select, update on public.admin_profiles to authenticated;
  foreach actor in array array[portal_id,ordinary_id,manager_id,super_id] loop
    role_code := case when actor=ordinary_id then 'content_editor' when actor=manager_id then 'admin' when actor=super_id then 'super_admin' else null end;
    perform set_config('request.jwt.claim.sub',actor::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','jnuits_admin_role',role_code)::text,true);
    execute 'set local role authenticated';
    result := public.is_super_admin_user(super_id);
    if result is distinct from (actor=manager_id or actor=super_id) then
      failures := array_append(failures,'role disclosure wrong for '||coalesce(role_code,'portal'));
    end if;
    if public.is_super_admin_user(ordinary_id) then
      failures := array_append(failures,'ordinary target classified super');
    end if;
    select count(*) into visible from public.admin_profiles where user_id=actor;
    if actor<>portal_id and visible<>1 then failures := array_append(failures,'self profile access broken for '||role_code); end if;
    select count(*) into visible from public.admin_profiles where user_id=super_id;
    if visible<>(case when actor=super_id then 1 else 0 end) then failures := array_append(failures,'super profile RLS wrong for '||coalesce(role_code,'portal')); end if;
    if actor=manager_id then
      update public.admin_profiles set display_name='Fictional editor updated' where user_id=ordinary_id;
      get diagnostics visible = row_count;
      if visible<>1 then failures := array_append(failures,'manager cannot edit ordinary profile'); end if;
      update public.admin_profiles set display_name='Should never update' where user_id=super_id;
      get diagnostics visible = row_count;
      if visible<>0 then failures := array_append(failures,'manager edited super profile'); end if;
    end if;
    execute 'reset role';
  end loop;

  -- Role setting reflects the invoker even inside SECURITY DEFINER. JWT metadata
  -- cannot turn an authenticated caller into a trusted service connection.
  perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
  perform set_config('request.jwt.claim.sub','',true);
  execute 'set local role service_role';
  if not public.is_super_admin_user(super_id) or public.is_super_admin_user(ordinary_id) then
    failures := array_append(failures,'service avatar/profile lookup broken');
  end if;
  execute 'reset role';
  execute 'set local role anon';
  begin
    perform public.is_super_admin_user(super_id);
    failures := array_append(failures,'anonymous helper callable');
  exception when insufficient_privilege then null; end;
  execute 'reset role';

  if cardinality(failures)>0 then raise exception 'AUDIT SECURITY REGRESSIONS: %',array_to_string(failures,'; '); end if;
  raise notice 'AUDIT SECURITY REGRESSIONS PASSED';
end
$audit_security$;
rollback;

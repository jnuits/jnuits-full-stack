-- Isolated replay only. Fictional consent fixtures and ACL changes roll back.
begin;
do $verify$
declare
  token_id uuid:=extensions.gen_random_uuid();
  second_id uuid:=extensions.gen_random_uuid();
  third_id uuid:=extensions.gen_random_uuid();
  attempt_id uuid:=extensions.gen_random_uuid();
  subscription_id uuid;
  result jsonb;
  role_name text;
  privilege_name text;
begin
  foreach role_name in array array['anon','authenticated','service_role'] loop
    foreach privilege_name in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES','MAINTAIN'] loop
      if has_table_privilege(role_name,'private.newsletter_subscriptions',privilege_name)
        or has_table_privilege(role_name,'private.newsletter_confirmation_tokens',privilege_name)
        or has_table_privilege(role_name,'private.newsletter_delivery_events',privilege_name) then
        raise exception 'Direct newsletter rows accessible by % (%)',role_name,privilege_name;
      end if;
    end loop;
  end loop;
  if has_function_privilege('anon','public.newsletter_store(text,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.newsletter_store(text,jsonb)','EXECUTE') then
    raise exception 'Browser newsletter RPC exposure';
  end if;
  set local role service_role;
  result:=public.newsletter_store('subscribe',jsonb_build_object('email','consenting@local.invalid','token_id',token_id,'token_hash',repeat('a',64)));
  if result->>'status'<>'send' then raise exception 'First consent not accepted'; end if;
  result:=public.newsletter_store('subscribe',jsonb_build_object('email','CONSENTING@local.invalid','token_id',second_id,'token_hash',repeat('b',64)));
  if result->>'status'<>'limited' then raise exception 'Email cooldown/case normalization missing'; end if;
  result:=public.newsletter_store('prepare',jsonb_build_object('token_hash',repeat('a',64),'attempt_id',attempt_id));
  if result->>'status'<>'newsletter_unavailable' then raise exception 'Undelivered token usable'; end if;
  perform public.newsletter_store('delivery',jsonb_build_object('token_id',token_id,'success',true,'message_id','newsletter-fictional-message'));
  result:=public.newsletter_store('prepare',jsonb_build_object('token_hash',repeat('a',64),'attempt_id',attempt_id));
  if result->>'status'<>'ready' then raise exception 'Delivered token unavailable'; end if;
  subscription_id:=(result->>'subscription_id')::uuid;
  result:=public.newsletter_store('prepare',jsonb_build_object('token_hash',repeat('a',64),'attempt_id',extensions.gen_random_uuid()));
  if result->>'status'<>'newsletter_unavailable' then raise exception 'Parallel lease not rejected'; end if;
  result:=public.newsletter_store('finish',jsonb_build_object('subscription_id',subscription_id,'token_id',token_id,'attempt_id',extensions.gen_random_uuid(),'status','confirmed','contact_id','fictional-contact'));
  if result->>'status'<>'newsletter_unavailable' then raise exception 'Wrong lease finalized'; end if;
  result:=public.newsletter_store('finish',jsonb_build_object('subscription_id',subscription_id,'token_id',token_id,'attempt_id',attempt_id,'status','pending'));
  if result->>'status'<>'newsletter_unavailable' then raise exception 'Partial provider failure marked active'; end if;
  reset role;
  if exists(select 1 from private.newsletter_subscriptions where id=subscription_id and state='active') then raise exception 'Failed synchronization active'; end if;
  set local role service_role;
  result:=public.newsletter_store('prepare',jsonb_build_object('token_hash',repeat('a',64),'attempt_id',attempt_id));
  if result->>'status'<>'ready' then raise exception 'Retryable sync not retried'; end if;
  result:=public.newsletter_store('finish',jsonb_build_object('subscription_id',subscription_id,'token_id',token_id,'attempt_id',attempt_id,'status','confirmed','contact_id','fictional-contact'));
  if result->>'status'<>'confirmed' then raise exception 'Successful confirmation not committed'; end if;
  reset role;
  update private.newsletter_confirmation_tokens set expires_at=now()-interval '1 second' where id=token_id;
  set local role service_role;
  result:=public.newsletter_store('prepare',jsonb_build_object('token_hash',repeat('a',64),'attempt_id',attempt_id));
  if result->>'status'<>'confirmed' then raise exception 'Completed replay not idempotent'; end if;
  result:=public.newsletter_store('webhook',jsonb_build_object('message_id','newsletter-fictional-message','event_id','newsletter-fictional-event','event_type','email.bounced','delivery_status','bounced','occurred_at',now()));
  if not (result->>'tracked')::boolean then raise exception 'Known delivery untracked'; end if;
  result:=public.newsletter_store('webhook',jsonb_build_object('message_id','newsletter-fictional-message','event_id','newsletter-fictional-event','event_type','email.bounced','delivery_status','bounced','occurred_at',now()));
  if not (result->>'duplicate')::boolean then raise exception 'Duplicate webhook not idempotent'; end if;
  perform public.newsletter_store('webhook',jsonb_build_object('message_id','newsletter-fictional-message','event_id','newsletter-fictional-delivered','event_type','email.delivered','delivery_status','delivered','occurred_at',now()));
  result:=public.newsletter_store('prepare',jsonb_build_object('token_hash',repeat('a',64),'attempt_id',attempt_id));
  if result->>'status'<>'preferences_required' then raise exception 'Suppressed token reactivated'; end if;

  result:=public.newsletter_store('subscribe',jsonb_build_object('email','cooldown@local.invalid','token_id',second_id,'token_hash',repeat('b',64)));
  reset role;
  update private.newsletter_confirmation_tokens set created_at=now()-interval '2 minutes' where id=second_id;
  set local role service_role;
  result:=public.newsletter_store('subscribe',jsonb_build_object('email','cooldown@local.invalid','token_id',third_id,'token_hash',repeat('c',64)));
  reset role;
  update private.newsletter_confirmation_tokens set created_at=now()-interval '70 seconds' where id=third_id;
  set local role service_role;
  result:=public.newsletter_store('subscribe',jsonb_build_object('email','cooldown@local.invalid','token_id',extensions.gen_random_uuid(),'token_hash',repeat('d',64)));
  if result->>'status'<>'send' then raise exception 'Third hourly send not accepted'; end if;
  reset role;
  update private.newsletter_confirmation_tokens set created_at=now()-interval '65 seconds' where token_hash=repeat('d',64);
  update private.newsletter_confirmation_tokens set expires_at=now()-interval '1 second',sent_at=now(),delivery_status='sent' where id=second_id;
  set local role service_role;
  result:=public.newsletter_store('subscribe',jsonb_build_object('email','cooldown@local.invalid','token_id',extensions.gen_random_uuid(),'token_hash',repeat('e',64)));
  if result->>'status'<>'limited' then raise exception 'More than three hourly sends accepted'; end if;
  result:=public.newsletter_store('prepare',jsonb_build_object('token_hash',repeat('b',64),'attempt_id',attempt_id));
  if result->>'status'<>'expired_token' then raise exception 'Expired unused token accepted'; end if;
  result:=public.newsletter_store('prepare',jsonb_build_object('token_hash',repeat('f',64),'attempt_id',attempt_id));
  if result->>'status'<>'invalid_token' then raise exception 'Unknown token accepted'; end if;
  reset role;
  raise notice 'NEWSLETTER CONSENT REGRESSIONS PASSED';
end;
$verify$;
rollback;

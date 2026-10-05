-- Cover newsletter token cascades without scanning all delivery events.
begin;
create index newsletter_delivery_events_token_idx
  on private.newsletter_delivery_events(token_id);
commit;

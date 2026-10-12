begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.committee_assignments add column speech text;
alter table public.committee_assignments add constraint committee_assignments_speech_length
  check (speech is null or char_length(speech) <= 160);
comment on column public.committee_assignments.speech is
  'Optional public leadership quote for this appointment. Internal notes remain in bio.';

commit;

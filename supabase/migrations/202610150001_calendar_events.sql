begin;
-- Apply after the accounts and group-planning migrations.
-- Queue changes commit atomically with the hangout; only the service role can process them.
create table if not exists public.calendar_event_jobs (
  event_id text primary key,
  group_id uuid not null references public.hangout_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  desired boolean not null default true,
  status text not null default 'pending' check (status in ('pending','synced','failed')),
  error_kind text,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  created_at timestamptz not null default now()
);
alter table public.calendar_event_jobs enable row level security;
revoke all on public.calendar_event_jobs from anon, authenticated;
grant all on public.calendar_event_jobs to service_role;
create index if not exists calendar_event_jobs_due on public.calendar_event_jobs(next_attempt_at) where status <> 'synced';

create or replace function public.queue_hangout_events() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb; activity jsonb; event_key text;
begin
  -- A new confirmation has a new ID so deleted Google event IDs are never reused.
  if new.document->>'status' = 'confirmed' and new.document->>'calendarRevision' is not null then
    select a into activity from jsonb_array_elements(new.document->'activities') a where a->>'id' = new.document->>'confirmedActivityId';
    for m in select * from jsonb_array_elements(new.document->'members') loop
      if m->>'userId' is not null and (m->>'consent')::boolean then
        event_key := md5(new.id::text || ':' || (new.document->>'calendarRevision') || ':' || (m->>'userId'));
        insert into public.calendar_event_jobs(event_id, group_id, user_id, payload)
        values (event_key, new.id, (m->>'userId')::uuid, jsonb_build_object(
          'summary', (new.document->>'name') || ' · ' || coalesce(activity->>'name','Hangout'),
          'description', coalesce(new.document->>'description','') || E'\nPlanned with Synchro.',
          'start', jsonb_build_object('dateTime',new.document->'selected'->>'start','timeZone',new.document->>'timeZone'),
          'end', jsonb_build_object('dateTime',new.document->'selected'->>'end','timeZone',new.document->>'timeZone'),
          'extendedProperties', jsonb_build_object('private',jsonb_build_object('synchroGroup',new.id::text,'synchroRevision',new.document->>'calendarRevision'))
        )) on conflict (event_id) do nothing;
      end if;
    end loop;
  end if;
  -- Remove obsolete copies, including partial writes, after cancellation/reopening.
  update public.calendar_event_jobs j set desired=false, status='pending', error_kind=null, next_attempt_at=now()
  where j.group_id=new.id and j.desired and (
    new.document->>'status' <> 'confirmed' or new.document->>'calendarRevision' is null or
    not exists (select 1 from jsonb_array_elements(new.document->'members') remaining_member
      where md5(new.id::text || ':' || (new.document->>'calendarRevision') || ':' || (remaining_member->>'userId'))=j.event_id)
  );
  return new;
end $$;
drop trigger if exists hangout_calendar_events on public.hangout_groups;
create trigger hangout_calendar_events after insert or update of document on public.hangout_groups
for each row execute function public.queue_hangout_events();

create or replace function public.claim_calendar_jobs(p_group uuid default null, p_force boolean default false)
returns setof public.calendar_event_jobs language plpgsql security definer set search_path = public as $$
begin
  return query
  with candidates as (
    select event_id from public.calendar_event_jobs
    where status <> 'synced' and (p_group is null or group_id=p_group)
      and (next_attempt_at <= now() or (p_force and p_group is not null))
      and (lease_until is null or lease_until < now())
    order by next_attempt_at limit 10 for update skip locked
  )
  update public.calendar_event_jobs j set lease_token=gen_random_uuid(), lease_until=now()+interval '2 minutes'
  from candidates c where j.event_id=c.event_id returning j.*;
end $$;

create or replace function public.finish_calendar_job(p_event text, p_lease uuid, p_desired boolean, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.calendar_event_jobs set
    status=case when desired<>p_desired then 'pending' when p_error is null then 'synced' else 'failed' end,
    error_kind=case when desired<>p_desired then null else p_error end,
    attempts=attempts+1,
    next_attempt_at=case when desired<>p_desired then now() else now()+interval '5 minutes' end,
    lease_token=null, lease_until=null
  where event_id=p_event and lease_token=p_lease;
end $$;
revoke all on function public.queue_hangout_events() from public, anon, authenticated;
revoke all on function public.claim_calendar_jobs(uuid,boolean) from public, anon, authenticated;
revoke all on function public.finish_calendar_job(text,uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.claim_calendar_jobs(uuid,boolean) to service_role;
grant execute on function public.finish_calendar_job(text,uuid,boolean,text) to service_role;

commit;

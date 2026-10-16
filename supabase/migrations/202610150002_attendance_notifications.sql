begin;
create table if not exists public.hangout_notifications (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 group_id uuid not null references public.hangout_groups(id) on delete cascade,
 title text not null,
 reason text not null,
 created_at timestamptz not null default now()
);
alter table public.hangout_notifications enable row level security;
revoke all on public.hangout_notifications from anon, authenticated;
grant select, insert, update, delete on public.hangout_notifications to service_role;
create index if not exists hangout_notifications_user on public.hangout_notifications(user_id,created_at desc);
create or replace function public.notify_attendance_removals() returns trigger
language plpgsql security definer set search_path=public as $$
declare request_record jsonb;
begin
 for request_record in select * from jsonb_array_elements(coalesce(new.document->'attendanceRequests','[]'::jsonb)) loop
  if request_record->>'status'='removed' then
   insert into public.hangout_notifications(id,user_id,group_id,title,reason)
   values ((request_record->>'id')::uuid,(request_record->>'userId')::uuid,new.id,
     'You are no longer attending ' || (new.document->>'name'),
     coalesce(nullif(request_record->>'responseReason',''),request_record->>'reason'))
   on conflict(id) do nothing;
  end if;
 end loop;
 return new;
end $$;
revoke all on function public.notify_attendance_removals() from public, anon, authenticated;
drop trigger if exists hangout_attendance_notifications on public.hangout_groups;
create trigger hangout_attendance_notifications after update of document on public.hangout_groups
for each row execute function public.notify_attendance_removals();
commit;

-- Phase 4. Run once after 202610130001_accounts_calendar.sql.
-- All access goes through authenticated Synchro server routes.
-- No browser role can read invitation emails, preference snapshots, or votes directly.
begin;
create table if not exists public.hangout_groups (
  id uuid primary key,
  invite_emails text[] not null check (cardinality(invite_emails) between 1 and 10),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now()
);
alter table public.hangout_groups enable row level security;
revoke all on public.hangout_groups from anon, authenticated;
grant select, insert, update, delete on public.hangout_groups to service_role;
create index if not exists hangout_groups_invite_emails_idx on public.hangout_groups using gin (invite_emails);
commit;

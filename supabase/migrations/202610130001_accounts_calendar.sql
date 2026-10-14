-- Apply in the Supabase SQL editor before enabling live mode.
begin;
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  preferences jsonb,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Insert own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "Update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
grant select, insert, update on public.profiles to authenticated;
revoke all on public.profiles from anon;

create table if not exists public.calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token_encrypted text not null,
  scope text not null,
  connected_at timestamptz not null default now()
);
alter table public.calendar_connections enable row level security;
-- No user-facing policies: only the server's service-role client may access tokens.
revoke all on public.calendar_connections from anon, authenticated;
grant all on public.calendar_connections to service_role;
commit;

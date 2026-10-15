create table if not exists public.login_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text,
  browser text,
  os text,
  user_agent text,
  last_seen timestamptz default now(),
  created_at timestamptz default now(),
  unique (user_id, device_id)
);

alter table public.login_sessions
  add column if not exists model text,
  add column if not exists ip text,
  add column if not exists city text,
  add column if not exists region text,
  add column if not exists country text,
  add column if not exists login_count integer not null default 1;

create index if not exists idx_login_sessions_user_seen on public.login_sessions (user_id, last_seen desc);

alter table public.login_sessions enable row level security;
drop policy if exists "login_sessions_select_own" on public.login_sessions;
create policy "login_sessions_select_own" on public.login_sessions for select using (auth.uid() = user_id);
drop policy if exists "login_sessions_delete_own" on public.login_sessions;
create policy "login_sessions_delete_own" on public.login_sessions for delete using (auth.uid() = user_id);

create table if not exists public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text,
  device_name text,
  model text,
  browser text,
  os text,
  user_agent text,
  ip text,
  city text,
  region text,
  country text,
  created_at timestamptz not null default now()
);

create index if not exists idx_login_events_user_created on public.login_events (user_id, created_at desc);

alter table public.login_events enable row level security;

-- =====================================================================
-- FASE 1 — Núcleo da plataforma (contas, livro-razão, KYC, auditoria)
-- Ordem: 400_platform_core.sql -> 200_futures_trading.sql -> 300_forex_admin.sql -> 410_platform_triggers.sql
-- Idempotente. Valores monetários sempre NUMERIC.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists document_number text;
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists country text default 'BR';
alter table public.profiles add column if not exists address_line text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists state text;
alter table public.profiles add column if not exists postal_code text;
alter table public.profiles add column if not exists occupation text;
alter table public.profiles add column if not exists trading_experience text;
alter table public.profiles add column if not exists kyc_status text not null default 'not_started';
alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.profiles add column if not exists is_blocked boolean not null default false;
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists balance numeric(20, 8) not null default 0;
alter table public.profiles add column if not exists preferences jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists last_login_at timestamptz;

do $$ begin
  alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin', 'support'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Saldo operacional usado pelo motor (linha travada FOR UPDATE nas RPCs)
-- ---------------------------------------------------------------------
create table if not exists public.user_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  balance numeric(20, 8) not null default 0,
  balance_real numeric(20, 8) not null default 0,
  balance_demo numeric(20, 8) not null default 10000,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Configurações do sistema
-- ---------------------------------------------------------------------
create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.system_settings (key, value, is_public) values
  ('demo_initial_balance', '10000'::jsonb, true),
  ('maintenance_mode', 'false'::jsonb, true),
  ('withdraw_daily_limit', '10000'::jsonb, true),
  ('mode', '"demo"'::jsonb, true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Contas (real | demo) e livro-razão imutável
-- ---------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('real', 'demo')),
  balance numeric(20, 8) not null default 0,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, type)
);

create table if not exists public.ledger_entries (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null,
  amount numeric(20, 8) not null,
  balance_before numeric(20, 8) not null,
  balance_after numeric(20, 8) not null,
  currency text not null default 'USD',
  ref_type text,
  ref_id text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ledger_user on public.ledger_entries (user_id, created_at desc);
create index if not exists idx_ledger_account on public.ledger_entries (account_id, created_at desc);

-- ---------------------------------------------------------------------
-- Instrumentos
-- ---------------------------------------------------------------------
create table if not exists public.instruments (
  symbol text primary key,
  base text not null,
  quote text not null,
  kind text not null default 'crypto',
  source text not null default 'binance',
  price_decimals integer not null default 2,
  qty_step numeric(20, 10) not null default 0.001,
  min_qty numeric(20, 10) not null default 0.001,
  max_leverage integer not null default 100 check (max_leverage between 1 and 1000),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.instruments (symbol, base, quote, price_decimals, qty_step, min_qty, max_leverage) values
  ('BTCUSDT', 'BTC', 'USDT', 2, 0.001, 0.001, 100),
  ('ETHUSDT', 'ETH', 'USDT', 2, 0.01, 0.01, 100),
  ('SOLUSDT', 'SOL', 'USDT', 3, 0.1, 0.1, 50),
  ('XRPUSDT', 'XRP', 'USDT', 4, 1, 1, 50),
  ('ADAUSDT', 'ADA', 'USDT', 4, 1, 1, 50),
  ('BNBUSDT', 'BNB', 'USDT', 2, 0.01, 0.01, 50),
  ('DOGEUSDT', 'DOGE', 'USDT', 5, 1, 1, 50)
on conflict (symbol) do nothing;

-- ---------------------------------------------------------------------
-- Depósitos e saques (camada de pagamento desacoplada via provider)
-- ---------------------------------------------------------------------
create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_type text not null default 'real' check (account_type in ('real', 'demo')),
  amount numeric(20, 8) not null check (amount > 0),
  currency text not null default 'USD',
  method text not null default 'mock',
  provider text not null default 'mock',
  external_id text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed', 'expired')),
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (user_id, idempotency_key)
);
create index if not exists idx_deposits_user on public.deposits (user_id, created_at desc);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(20, 8) not null check (amount > 0),
  currency text not null default 'USD',
  method text not null,
  destination jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid', 'cancelled')),
  idempotency_key text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists idx_withdrawals_user on public.withdrawals (user_id, created_at desc);
create index if not exists idx_withdrawals_pending on public.withdrawals (status) where status = 'pending';

-- ---------------------------------------------------------------------
-- KYC, auditoria e layouts do gráfico
-- ---------------------------------------------------------------------
create table if not exists public.kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected')),
  personal_data jsonb not null default '{}'::jsonb,
  address_data jsonb not null default '{}'::jsonb,
  document_type text,
  document_front_path text,
  document_back_path text,
  selfie_path text,
  provider text not null default 'manual',
  provider_ref text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_kyc_user on public.kyc_submissions (user_id, created_at desc);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_created on public.audit_logs (created_at desc);
create index if not exists idx_audit_actor on public.audit_logs (actor_id, created_at desc);

create table if not exists public.chart_layouts (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  symbol text not null,
  drawings jsonb not null default '[]'::jsonb,
  indicators jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

-- ---------------------------------------------------------------------
-- Helper de role
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.role = 'admin' or p.is_admin)
  );
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_balances enable row level security;
alter table public.system_settings enable row level security;
alter table public.accounts enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.instruments enable row level security;
alter table public.deposits enable row level security;
alter table public.withdrawals enable row level security;
alter table public.kyc_submissions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.chart_layouts enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (auth.uid() = id or public.is_admin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists user_balances_select on public.user_balances;
create policy user_balances_select on public.user_balances for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists system_settings_select on public.system_settings;
create policy system_settings_select on public.system_settings for select using (is_public or public.is_admin());

drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists ledger_select on public.ledger_entries;
create policy ledger_select on public.ledger_entries for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists instruments_select on public.instruments;
create policy instruments_select on public.instruments for select using (true);

drop policy if exists deposits_select on public.deposits;
create policy deposits_select on public.deposits for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists withdrawals_select on public.withdrawals;
create policy withdrawals_select on public.withdrawals for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists kyc_select on public.kyc_submissions;
create policy kyc_select on public.kyc_submissions for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists audit_select_admin on public.audit_logs;
create policy audit_select_admin on public.audit_logs for select using (public.is_admin());

drop policy if exists chart_layouts_select on public.chart_layouts;
create policy chart_layouts_select on public.chart_layouts for select using (auth.uid() = user_id);
drop policy if exists chart_layouts_insert on public.chart_layouts;
create policy chart_layouts_insert on public.chart_layouts for insert with check (auth.uid() = user_id);
drop policy if exists chart_layouts_update on public.chart_layouts;
create policy chart_layouts_update on public.chart_layouts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists chart_layouts_delete on public.chart_layouts;
create policy chart_layouts_delete on public.chart_layouts for delete using (auth.uid() = user_id);

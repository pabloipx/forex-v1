-- =====================================================================
-- KOBILEX BROKER — SCHEMA COMPLETO (fonte unica de verdade)
-- =====================================================================
-- Substitui e consolida 000..021 e os scripts de correcao avulsos.
-- Cada coluna aqui foi conferida contra o codigo que a le/escreve, para
-- que nenhuma rota do admin quebre com erro 42703 (coluna inexistente).
-- Idempotente: pode rodar quantas vezes for preciso.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABELAS
-- ---------------------------------------------------------------------

-- 1.1 profiles (estende auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  nickname text,
  phone text,
  cpf text,
  country text default 'BR',
  account_type text default 'individual',
  birth_date date,
  is_admin boolean default false,
  is_verified boolean default false,
  is_blocked boolean default false,
  kyc_status text default 'pending',
  -- Espelho do saldo real, lido por telas de listagem que nao fazem join
  -- em user_balances. user_balances continua sendo a fonte de verdade.
  balance decimal(15,2) default 0.00,
  is_affiliate boolean default false,
  affiliate_code varchar(20) unique,
  affiliate_status varchar(20) default 'inactive',
  affiliate_commission_model varchar(20) default 'hybrid',
  affiliate_commission_percent decimal(5,2) default 77.00,
  affiliate_cpa_amount decimal(15,2) default 100.00,
  affiliate_cpa_min_deposit decimal(15,2) default 50.00,
  affiliate_sub_percent decimal(5,2) default 5.00,
  affiliate_notes text,
  referred_by varchar(20),
  affiliate_balance decimal(15,2) default 0.00,
  affiliate_total_earned decimal(15,2) default 0.00,
  affiliate_total_referrals integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Colunas adicionadas depois da criacao original da tabela
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists country text default 'BR';
alter table public.profiles add column if not exists account_type text default 'individual';
alter table public.profiles add column if not exists balance decimal(15,2) default 0.00;
alter table public.profiles add column if not exists affiliate_commission_model varchar(20) default 'hybrid';
alter table public.profiles add column if not exists affiliate_cpa_amount decimal(15,2) default 100.00;
alter table public.profiles add column if not exists affiliate_cpa_min_deposit decimal(15,2) default 50.00;
alter table public.profiles add column if not exists affiliate_sub_percent decimal(5,2) default 5.00;
alter table public.profiles add column if not exists affiliate_notes text;

create index if not exists idx_profiles_referred_by on public.profiles(referred_by);
create index if not exists idx_profiles_is_affiliate on public.profiles(is_affiliate) where is_affiliate = true;

-- 1.2 user_balances (fonte de verdade do saldo)
create table if not exists public.user_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  balance_real decimal(15,2) default 0.00,
  balance_demo decimal(15,2) default 10000.00,
  balance decimal(15,2) default 0.00,
  currency text default 'BRL',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 1.3 deposits
create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  amount decimal(15,2) not null,
  currency text default 'BRL',
  method text default 'pix',
  payment_method text default 'pix',
  status text default 'pending',
  external_id text,
  qr_code text,
  qr_code_base64 text,
  copy_paste text,
  payment_reference text,
  -- Detalhes especificos do meio de pagamento (rede, hash, carteira, ...).
  -- JSONB porque cada provedor devolve um conjunto diferente de campos.
  payment_details jsonb,
  promo_code text,
  pix_payment_id uuid,
  -- Data da confirmacao do pagamento. O codigo grava em paid_at.
  paid_at timestamptz,
  processed_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.deposits add column if not exists payment_details jsonb;
alter table public.deposits add column if not exists paid_at timestamptz;
alter table public.deposits add column if not exists promo_code text;
create index if not exists idx_deposits_user_id on public.deposits(user_id);
create index if not exists idx_deposits_external_id on public.deposits(external_id);
create index if not exists idx_deposits_status on public.deposits(status);

-- 1.4 withdrawals
create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  amount decimal(15,2) not null,
  currency text default 'BRL',
  method text default 'pix',
  pix_key text,
  pix_key_type text,
  crypto_type text,
  crypto_wallet text,
  holder_name text,
  document text,
  status text default 'pending',
  admin_notes text,
  processed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.withdrawals add column if not exists holder_name text;
alter table public.withdrawals add column if not exists document text;
alter table public.withdrawals add column if not exists admin_notes text;
create index if not exists idx_withdrawals_user_id on public.withdrawals(user_id);
create index if not exists idx_withdrawals_status on public.withdrawals(status);

-- 1.5 trades
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  symbol text not null,
  direction text not null,
  amount decimal(15,2) not null,
  entry_price decimal(20,8) not null,
  exit_price decimal(20,8),
  timeframe integer not null,
  payout_percentage decimal(5,2) default 85,
  result text default 'pending',
  profit decimal(15,2),
  is_demo boolean default false,
  is_manually_adjusted boolean default false,
  adjusted_by text,
  adjusted_at timestamptz,
  entry_time timestamptz default now(),
  expiry_time timestamptz,
  exit_time timestamptz,
  closed_at timestamptz,
  created_at timestamptz default now()
);
alter table public.trades add column if not exists closed_at timestamptz;
create index if not exists idx_trades_user_result on public.trades(user_id, result);
create index if not exists idx_trades_expiry_result on public.trades(expiry_time, result);
create index if not exists idx_trades_created_at on public.trades(created_at desc);

-- 1.6 otc_symbols (catalogo de ativos)
create table if not exists public.otc_symbols (
  id uuid primary key default gen_random_uuid(),
  symbol text unique not null,
  name text,
  category text default 'forex',
  base_price decimal(20,8) not null,
  volatility decimal(10,6) default 0.001,
  payout_percentage integer default 85,
  min_trade_amount decimal(15,2) default 1,
  max_trade_amount decimal(15,2) default 10000,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 1.7 asset_settings (habilitar/ordenar ativos e payout por ativo)
create table if not exists public.asset_settings (
  id uuid primary key default gen_random_uuid(),
  symbol text unique not null,
  enabled boolean default true,
  payout integer default 85,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.asset_settings add column if not exists payout integer default 85;

-- 1.8 otc_manipulations (controle de tendencia pelo admin)
create table if not exists public.otc_manipulations (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  direction text not null check (direction in ('up', 'down')),
  timeframe integer not null,
  start_time timestamptz not null default now(),
  end_time timestamptz not null,
  duration_candles integer not null default 1,
  strength integer not null default 60,
  style text not null default 'natural',
  active boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists idx_otc_manipulations_active
  on public.otc_manipulations(symbol, active, end_time) where active = true;

-- 1.9 market_candles_1m (velas de 1m montadas a partir de ticks reais)
-- Chave composta: uma vela por simbolo/minuto. bucket_time e epoch em segundos.
create table if not exists public.market_candles_1m (
  symbol text not null,
  bucket_time bigint not null,
  open numeric(20,8) not null,
  high numeric(20,8) not null,
  low numeric(20,8) not null,
  close numeric(20,8) not null,
  updated_at timestamptz not null default now(),
  primary key (symbol, bucket_time)
);
create index if not exists idx_market_candles_bucket on public.market_candles_1m(bucket_time);

-- 1.10 kyc_requests
create table if not exists public.kyc_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  document_type text,
  document_front_url text,
  document_back_url text,
  -- Nome usado pelo codigo (nao "selfie_url")
  selfie_with_document_url text,
  status text default 'pending',
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);
alter table public.kyc_requests add column if not exists selfie_with_document_url text;
create index if not exists idx_kyc_requests_user_id on public.kyc_requests(user_id);

-- 1.11 platform_settings (config chave/valor)
create table if not exists public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text unique not null,
  setting_value jsonb,
  description text,
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 1.12 transactions (extrato do usuario)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  amount decimal(15,2) not null,
  -- Saldo apos o lancamento, para o extrato nao precisar recalcular
  balance_after decimal(15,2),
  account_type text default 'real',
  -- Id da entidade que originou o lancamento (deposito, saque, bonus, ...)
  reference_id uuid,
  status text default 'completed',
  description text,
  created_at timestamptz default now()
);
alter table public.transactions add column if not exists balance_after decimal(15,2);
alter table public.transactions add column if not exists account_type text default 'real';
alter table public.transactions add column if not exists reference_id uuid;
create index if not exists idx_transactions_user_id on public.transactions(user_id);

-- 1.13 card_deposits
-- Nunca guarda numero completo, validade ou CVV: apenas os 4 ultimos digitos
-- e a bandeira, que e o suficiente para o admin conferir o pagamento.
create table if not exists public.card_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  deposit_id uuid references public.deposits(id) on delete set null,
  holder_name text,
  document text,
  card_last4 text,
  card_brand text,
  amount decimal(15,2) not null,
  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_card_deposits_user_id on public.card_deposits(user_id);
create index if not exists idx_card_deposits_status on public.card_deposits(status);

-- 1.14 admin_users
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- 1.15 login_sessions (dispositivos conectados)
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
create index if not exists idx_login_sessions_user on public.login_sessions(user_id);

-- 1.16 trade_history_log (auditoria das edicoes do admin)
create table if not exists public.trade_history_log (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null,
  user_id uuid not null,
  admin_id text not null,
  old_status text,
  new_status text,
  old_value decimal(15,2),
  new_value decimal(15,2),
  old_profit decimal(15,2),
  new_profit decimal(15,2),
  old_direction text,
  new_direction text,
  old_timeframe integer,
  new_timeframe integer,
  old_created_at timestamptz,
  new_created_at timestamptz,
  balance_before decimal(15,2),
  balance_after decimal(15,2),
  balance_adjustment decimal(15,2),
  changed_at timestamptz default now()
);
create index if not exists idx_trade_history_log_trade on public.trade_history_log(trade_id);

-- ---------------------------------------------------------------------
-- 2. AFILIADOS
-- ---------------------------------------------------------------------

-- 2.1 affiliate_global_settings (linha unica, id = 1)
create table if not exists public.affiliate_global_settings (
  id integer primary key default 1 check (id = 1),
  default_revshare_percent decimal(5,2) not null default 77.00,
  default_cpa_amount decimal(15,2) not null default 100.00,
  cpa_min_deposit decimal(15,2) not null default 50.00,
  sub_affiliate_percent decimal(5,2) not null default 5.00,
  min_withdrawal decimal(15,2) not null default 250.00,
  withdrawal_fee_percent decimal(5,2) not null default 2.00,
  program_enabled boolean not null default true,
  auto_approve_affiliates boolean not null default true,
  display_currency varchar(3) not null default 'BRL' check (display_currency in ('BRL', 'USD')),
  usd_rate decimal(10,4) not null default 5.4,
  next_payment_date date,
  updated_at timestamptz default now(),
  updated_by uuid
);

-- 2.2 affiliate_commissions
-- reference_id (e nao deposit_id) e a chave de idempotencia usada pelo codigo:
-- o webhook do provedor pode reenviar o mesmo pagamento, e o UNIQUE impede
-- que a comissao seja creditada duas vezes.
create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.profiles(id) on delete cascade,
  referred_user_id uuid not null references public.profiles(id) on delete cascade,
  reference_id uuid unique,
  deposit_id uuid references public.deposits(id) on delete cascade,
  type varchar(20) not null default 'revshare',
  status varchar(20) not null default 'approved',
  base_amount decimal(15,2),
  deposit_amount decimal(15,2),
  percent decimal(5,2),
  amount decimal(15,2) not null default 0,
  revshare_amount decimal(15,2) default 0,
  cpa_amount decimal(15,2) default 0,
  level integer default 1,
  description text,
  created_at timestamptz default now()
);
create index if not exists idx_affiliate_commissions_affiliate_id on public.affiliate_commissions(affiliate_id);
create index if not exists idx_affiliate_commissions_referred_user_id on public.affiliate_commissions(referred_user_id);

-- 2.3 affiliate_withdrawals
create table if not exists public.affiliate_withdrawals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.profiles(id) on delete cascade,
  amount decimal(15,2) not null,
  fee decimal(15,2) default 0.00,
  net_amount decimal(15,2),
  status varchar(20) default 'pending',
  method varchar(20) default 'pix',
  pix_key varchar(255),
  pix_key_type varchar(20),
  wallet_address text,
  admin_notes text,
  processed_at timestamptz,
  processed_by uuid references public.profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_affiliate_withdrawals_affiliate_id on public.affiliate_withdrawals(affiliate_id);
create index if not exists idx_affiliate_withdrawals_status on public.affiliate_withdrawals(status);

-- 2.4 affiliate_payment_methods
create table if not exists public.affiliate_payment_methods (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.profiles(id) on delete cascade,
  type varchar(20) not null check (type in ('usdt', 'pix')),
  wallet_address text,
  pix_key text,
  pix_key_type varchar(20),
  is_default boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_affiliate_payment_methods_affiliate on public.affiliate_payment_methods(affiliate_id);

-- 2.5 affiliate_admin_logs (auditoria do painel de afiliados)
-- affiliate_id e nulo nas acoes globais (ex.: update_settings), por isso nao
-- tem NOT NULL nem FK obrigatoria.
create table if not exists public.affiliate_admin_logs (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid,
  action text not null,
  field text,
  old_value text,
  new_value text,
  note text,
  created_at timestamptz default now()
);
create index if not exists idx_affiliate_admin_logs_affiliate on public.affiliate_admin_logs(affiliate_id);
create index if not exists idx_affiliate_admin_logs_created on public.affiliate_admin_logs(created_at desc);

-- ---------------------------------------------------------------------
-- 3. BONUS / ROLLOVER
-- ---------------------------------------------------------------------

-- 3.1 promo_codes
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  bonus_type text not null default 'percent' check (bonus_type in ('percent', 'fixed')),
  bonus_value numeric(12,2) not null check (bonus_value > 0),
  max_bonus numeric(12,2) check (max_bonus is null or max_bonus > 0),
  min_deposit numeric(12,2) not null default 0 check (min_deposit >= 0),
  rollover_multiplier numeric(6,2) not null default 1 check (rollover_multiplier >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  uses_count integer not null default 0 check (uses_count >= 0),
  max_uses_per_user integer not null default 1 check (max_uses_per_user > 0),
  is_active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3.2 user_bonuses
create table if not exists public.user_bonuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  promo_code_id uuid references public.promo_codes(id) on delete set null,
  deposit_id uuid unique references public.deposits(id) on delete cascade,
  code text not null,
  deposit_amount numeric(12,2) not null,
  bonus_amount numeric(12,2) not null,
  rollover_required numeric(14,2) not null,
  rollover_progress numeric(14,2) not null default 0,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  granted_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text
);
create index if not exists idx_user_bonuses_user on public.user_bonuses(user_id);
create index if not exists idx_user_bonuses_active on public.user_bonuses(user_id, status) where status = 'active';
-- Um unico bonus travado por vez: com dois, a mesma operacao abateria os dois.
create unique index if not exists idx_user_bonuses_one_active
  on public.user_bonuses(user_id) where status = 'active';

-- 3.3 deposit_rollovers
create table if not exists public.deposit_rollovers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deposit_id uuid not null unique references public.deposits(id) on delete cascade,
  deposit_amount numeric(12,2) not null,
  multiplier numeric(6,2) not null,
  rollover_required numeric(14,2) not null,
  rollover_progress numeric(14,2) not null default 0,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  granted_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text
);
create index if not exists idx_deposit_rollovers_user on public.deposit_rollovers(user_id);
create index if not exists idx_deposit_rollovers_active
  on public.deposit_rollovers(user_id, status) where status = 'active';

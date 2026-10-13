-- =====================================================================
-- SETUP COMPLETO DO BANCO (projeto Supabase NOVO)
-- Cole este arquivo inteiro no Supabase > SQL Editor > New query > Run.
-- Idempotente: pode rodar de novo sem quebrar nada.
-- Conteudo: 100_full_schema.sql + 200_futures_trading.sql + storage KYC.
-- =====================================================================

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


-- =====================================================================
-- FUTUROS / FOREX (estilo Bybit) — rodar DEPOIS de 100_full_schema.sql
-- =====================================================================
-- Idempotente: pode rodar quantas vezes for preciso.
--
-- Modelo: contratos perpetuos lineares liquidados em USD, modo "one-way"
-- (uma posicao liquida por simbolo e por conta demo/real).
--
-- Toda alteracao de saldo/posicao passa por funcoes plpgsql que travam a
-- linha de user_balances (FOR UPDATE). Assim duas ordens simultaneas nunca
-- leem o mesmo saldo e o saldo nunca fica inconsistente com as posicoes.
-- As funcoes so podem ser executadas pela service_role (servidor).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Gatilho de novo usuario (perfil + saldo)
-- ---------------------------------------------------------------------
-- A rota /api/auth/sign-up assume que esse gatilho existe. Sem ele o
-- usuario nascia sem linha em user_balances e nao conseguia operar.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;

  insert into public.user_balances (user_id, balance, balance_real, balance_demo, currency)
  values (new.id, 0, 0, 10000, 'USD')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuarios antigos que ficaram sem perfil/saldo
insert into public.profiles (id, email)
select u.id, u.email from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

insert into public.user_balances (user_id, balance, balance_real, balance_demo, currency)
select u.id, 0, 0, 10000, 'USD' from auth.users u
left join public.user_balances b on b.user_id = u.id
where b.user_id is null
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------
-- 1. TABELAS
-- ---------------------------------------------------------------------

create table if not exists public.futures_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('long', 'short')),
  qty numeric(28, 10) not null check (qty >= 0),
  entry_price numeric(28, 10) not null,
  leverage integer not null check (leverage between 1 and 1000),
  margin_mode text not null default 'isolated' check (margin_mode in ('isolated', 'cross')),
  margin numeric(20, 8) not null default 0,
  contract_size numeric(20, 8) not null default 1,
  liquidation_price numeric(28, 10),
  take_profit numeric(28, 10),
  stop_loss numeric(28, 10),
  realized_pnl numeric(20, 8) not null default 0,
  fees_paid numeric(20, 8) not null default 0,
  exit_price numeric(28, 10),
  close_reason text,
  status text not null default 'open' check (status in ('open', 'closed', 'liquidated')),
  is_demo boolean not null default false,
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

-- Garante uma unica posicao aberta por simbolo/conta (modo one-way)
create unique index if not exists uq_futures_positions_open
  on public.futures_positions (user_id, symbol, is_demo)
  where status = 'open';
create index if not exists idx_futures_positions_user on public.futures_positions (user_id, status, closed_at desc);
create index if not exists idx_futures_positions_open on public.futures_positions (status) where status = 'open';

create table if not exists public.futures_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  order_type text not null check (order_type in ('market', 'limit', 'conditional')),
  price numeric(28, 10),
  trigger_price numeric(28, 10),
  trigger_direction text check (trigger_direction in ('rise', 'fall')),
  qty numeric(28, 10) not null check (qty > 0),
  leverage integer not null default 10,
  margin_mode text not null default 'isolated' check (margin_mode in ('isolated', 'cross')),
  contract_size numeric(20, 8) not null default 1,
  reduce_only boolean not null default false,
  post_only boolean not null default false,
  time_in_force text not null default 'GTC' check (time_in_force in ('GTC', 'IOC', 'FOK', 'PostOnly')),
  take_profit numeric(28, 10),
  stop_loss numeric(28, 10),
  reserved_margin numeric(20, 8) not null default 0,
  status text not null default 'open' check (status in ('open', 'filled', 'cancelled', 'rejected')),
  filled_price numeric(28, 10),
  filled_qty numeric(28, 10) not null default 0,
  fee numeric(20, 8) not null default 0,
  reject_reason text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_futures_orders_user on public.futures_orders (user_id, status, created_at desc);
create index if not exists idx_futures_orders_open on public.futures_orders (status) where status = 'open';

create table if not exists public.futures_fills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.futures_orders(id) on delete set null,
  position_id uuid references public.futures_positions(id) on delete set null,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  price numeric(28, 10) not null,
  qty numeric(28, 10) not null,
  fee numeric(20, 8) not null default 0,
  realized_pnl numeric(20, 8) not null default 0,
  exec_type text not null default 'trade',
  is_maker boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_futures_fills_user on public.futures_fills (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 2. RLS: usuario so le as proprias linhas. Escrita apenas pelo servidor.
-- ---------------------------------------------------------------------
alter table public.futures_positions enable row level security;
alter table public.futures_orders enable row level security;
alter table public.futures_fills enable row level security;

drop policy if exists "futures_positions_select_own" on public.futures_positions;
create policy "futures_positions_select_own" on public.futures_positions
  for select using (auth.uid() = user_id);

drop policy if exists "futures_orders_select_own" on public.futures_orders;
create policy "futures_orders_select_own" on public.futures_orders
  for select using (auth.uid() = user_id);

drop policy if exists "futures_fills_select_own" on public.futures_fills;
create policy "futures_fills_select_own" on public.futures_fills
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 3. FUNCOES
-- ---------------------------------------------------------------------

-- Taxa de manutencao usada no calculo do preco de liquidacao
create or replace function public.futures_liq_price(p_side text, p_entry numeric, p_leverage integer)
returns numeric
language sql
immutable
as $$
  select case
    when p_side = 'long' then greatest(p_entry * (1 - 1.0 / p_leverage + 0.005), 0)
    else p_entry * (1 + 1.0 / p_leverage - 0.005)
  end;
$$;

-- Le e trava o saldo da conta escolhida. Cria a linha se faltar.
create or replace function public.futures_lock_balance(p_user uuid, p_is_demo boolean)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bal numeric;
begin
  insert into public.user_balances (user_id, balance, balance_real, balance_demo, currency)
  values (p_user, 0, 0, 10000, 'USD')
  on conflict (user_id) do nothing;

  if p_is_demo then
    select balance_demo into v_bal from public.user_balances where user_id = p_user for update;
  else
    select balance into v_bal from public.user_balances where user_id = p_user for update;
  end if;
  return coalesce(v_bal, 0);
end;
$$;

create or replace function public.futures_set_balance(p_user uuid, p_is_demo boolean, p_value numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_is_demo then
    update public.user_balances
      set balance_demo = round(greatest(p_value, 0), 2), updated_at = now()
      where user_id = p_user;
  else
    update public.user_balances
      set balance = round(greatest(p_value, 0), 2),
          balance_real = round(greatest(p_value, 0), 2),
          updated_at = now()
      where user_id = p_user;
    update public.profiles set balance = round(greatest(p_value, 0), 2), updated_at = now() where id = p_user;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- futures_fill: executa uma quantidade a um preco (o nucleo do motor).
--   - mesma direcao da posicao (ou sem posicao): abre/aumenta
--   - direcao oposta: reduz/fecha e, se sobrar, inverte a posicao
-- p_quote_usd converte valores na moeda de cotacao para USD
-- (1 para pares XXX/USD, 1/preco para pares USD/XXX).
-- Se p_order_id for informado, a reserva da ordem e devolvida e a ordem
-- e marcada como executada na mesma transacao.
-- ---------------------------------------------------------------------
create or replace function public.futures_fill(
  p_user uuid,
  p_is_demo boolean,
  p_symbol text,
  p_side text,
  p_qty numeric,
  p_price numeric,
  p_leverage integer,
  p_margin_mode text,
  p_contract_size numeric,
  p_quote_usd numeric,
  p_fee_rate numeric,
  p_reduce_only boolean default false,
  p_take_profit numeric default null,
  p_stop_loss numeric default null,
  p_order_id uuid default null,
  p_exec_type text default 'trade',
  p_is_maker boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bal numeric;
  v_pos public.futures_positions%rowtype;
  v_order public.futures_orders%rowtype;
  v_pos_side text := case when p_side = 'buy' then 'long' else 'short' end;
  v_dir numeric;
  v_close_qty numeric := 0;
  v_open_qty numeric := 0;
  v_pnl numeric := 0;
  v_released numeric := 0;
  v_fee numeric := 0;
  v_fee_close numeric := 0;
  v_fee_open numeric := 0;
  v_margin numeric := 0;
  v_new_entry numeric;
  v_position_id uuid;
  v_status text;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'Quantidade invalida'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Preco invalido'; end if;
  if p_side not in ('buy', 'sell') then raise exception 'Lado invalido'; end if;

  v_bal := public.futures_lock_balance(p_user, p_is_demo);

  -- Devolve a reserva da ordem limite/condicional antes de executar
  if p_order_id is not null then
    select * into v_order from public.futures_orders
      where id = p_order_id and user_id = p_user for update;
    if not found or v_order.status <> 'open' then
      raise exception 'Ordem nao esta aberta';
    end if;
    v_bal := v_bal + v_order.reserved_margin;
  end if;

  select * into v_pos from public.futures_positions
    where user_id = p_user and symbol = p_symbol and is_demo = p_is_demo and status = 'open'
    for update;

  if found and v_pos.side <> v_pos_side then
    -- Reduz / fecha
    v_close_qty := least(p_qty, v_pos.qty);
    v_dir := case when v_pos.side = 'long' then 1 else -1 end;
    v_pnl := v_close_qty * v_pos.contract_size * (p_price - v_pos.entry_price) * v_dir * p_quote_usd;
    v_released := v_pos.margin * v_close_qty / v_pos.qty;
    v_fee_close := v_close_qty * v_pos.contract_size * p_price * p_quote_usd * p_fee_rate;
    -- Em margem isolada a perda maxima e a margem da posicao
    if v_pos.margin_mode = 'isolated' and v_pnl < -v_released then
      v_pnl := -v_released;
    end if;
    v_bal := v_bal + v_released + v_pnl - v_fee_close;

    if v_close_qty >= v_pos.qty then
      v_status := case when p_exec_type = 'liquidation' then 'liquidated' else 'closed' end;
      update public.futures_positions set
        qty = 0,
        margin = 0,
        realized_pnl = realized_pnl + v_pnl,
        fees_paid = fees_paid + v_fee_close,
        exit_price = p_price,
        close_reason = p_exec_type,
        status = v_status,
        closed_at = now(),
        updated_at = now()
      where id = v_pos.id;
    else
      update public.futures_positions set
        qty = qty - v_close_qty,
        margin = margin - v_released,
        realized_pnl = realized_pnl + v_pnl,
        fees_paid = fees_paid + v_fee_close,
        updated_at = now()
      where id = v_pos.id;
    end if;
    v_position_id := v_pos.id;
    v_open_qty := case when p_reduce_only then 0 else p_qty - v_close_qty end;
  else
    if p_reduce_only then
      raise exception 'Ordem reduce-only sem posicao oposta para reduzir';
    end if;
    v_open_qty := p_qty;
  end if;

  -- Abre / aumenta
  if v_open_qty > 0 then
    v_margin := v_open_qty * p_contract_size * p_price * p_quote_usd / p_leverage;
    v_fee_open := v_open_qty * p_contract_size * p_price * p_quote_usd * p_fee_rate;
    if v_bal < v_margin + v_fee_open then
      raise exception 'Saldo insuficiente';
    end if;
    v_bal := v_bal - v_margin - v_fee_open;

    select * into v_pos from public.futures_positions
      where user_id = p_user and symbol = p_symbol and is_demo = p_is_demo and status = 'open'
      for update;

    if found then
      v_new_entry := (v_pos.qty * v_pos.entry_price + v_open_qty * p_price) / (v_pos.qty + v_open_qty);
      update public.futures_positions set
        qty = qty + v_open_qty,
        entry_price = v_new_entry,
        margin = margin + v_margin,
        fees_paid = fees_paid + v_fee_open,
        liquidation_price = public.futures_liq_price(side, v_new_entry, leverage),
        take_profit = coalesce(p_take_profit, take_profit),
        stop_loss = coalesce(p_stop_loss, stop_loss),
        updated_at = now()
      where id = v_pos.id;
      v_position_id := v_pos.id;
    else
      insert into public.futures_positions (
        user_id, symbol, side, qty, entry_price, leverage, margin_mode, margin,
        contract_size, liquidation_price, take_profit, stop_loss, fees_paid, is_demo
      ) values (
        p_user, p_symbol, v_pos_side, v_open_qty, p_price, p_leverage, p_margin_mode, v_margin,
        p_contract_size, public.futures_liq_price(v_pos_side, p_price, p_leverage),
        p_take_profit, p_stop_loss, v_fee_open, p_is_demo
      )
      returning id into v_position_id;
    end if;
  end if;

  v_fee := v_fee_close + v_fee_open;
  perform public.futures_set_balance(p_user, p_is_demo, v_bal);

  if p_order_id is not null then
    update public.futures_orders set
      status = 'filled',
      filled_price = p_price,
      filled_qty = p_qty,
      fee = v_fee,
      reserved_margin = 0,
      updated_at = now()
    where id = p_order_id;
  end if;

  insert into public.futures_fills (
    user_id, order_id, position_id, symbol, side, price, qty, fee,
    realized_pnl, exec_type, is_maker, is_demo
  ) values (
    p_user, p_order_id, v_position_id, p_symbol, p_side, p_price, p_qty, v_fee,
    v_pnl, p_exec_type, p_is_maker, p_is_demo
  );

  return jsonb_build_object(
    'position_id', v_position_id,
    'balance', round(greatest(v_bal, 0), 2),
    'realized_pnl', v_pnl,
    'fee', v_fee
  );
end;
$$;

-- Coloca uma ordem limite/condicional reservando margem + taxa estimada
create or replace function public.futures_place_order(
  p_user uuid,
  p_is_demo boolean,
  p_symbol text,
  p_side text,
  p_order_type text,
  p_price numeric,
  p_trigger_price numeric,
  p_trigger_direction text,
  p_qty numeric,
  p_leverage integer,
  p_margin_mode text,
  p_contract_size numeric,
  p_quote_usd numeric,
  p_fee_rate numeric,
  p_reduce_only boolean,
  p_post_only boolean,
  p_time_in_force text,
  p_take_profit numeric,
  p_stop_loss numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bal numeric;
  v_ref_price numeric := coalesce(p_price, p_trigger_price);
  v_reserve numeric := 0;
  v_id uuid;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'Quantidade invalida'; end if;
  if v_ref_price is null or v_ref_price <= 0 then raise exception 'Preco invalido'; end if;

  v_bal := public.futures_lock_balance(p_user, p_is_demo);

  if not p_reduce_only then
    v_reserve := p_qty * p_contract_size * v_ref_price * p_quote_usd * (1.0 / p_leverage + p_fee_rate);
    if v_bal < v_reserve then
      raise exception 'Saldo insuficiente';
    end if;
    perform public.futures_set_balance(p_user, p_is_demo, v_bal - v_reserve);
  end if;

  insert into public.futures_orders (
    user_id, symbol, side, order_type, price, trigger_price, trigger_direction, qty,
    leverage, margin_mode, contract_size, reduce_only, post_only, time_in_force,
    take_profit, stop_loss, reserved_margin, is_demo
  ) values (
    p_user, p_symbol, p_side, p_order_type, p_price, p_trigger_price, p_trigger_direction, p_qty,
    p_leverage, p_margin_mode, p_contract_size, p_reduce_only, p_post_only, p_time_in_force,
    p_take_profit, p_stop_loss, v_reserve, p_is_demo
  )
  returning id into v_id;

  return jsonb_build_object('order_id', v_id, 'balance', round(greatest(v_bal - v_reserve, 0), 2));
end;
$$;

-- Cancela/rejeita uma ordem aberta devolvendo a reserva
create or replace function public.futures_cancel_order(
  p_user uuid,
  p_order_id uuid,
  p_status text default 'cancelled',
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.futures_orders%rowtype;
  v_bal numeric;
begin
  select * into v_order from public.futures_orders
    where id = p_order_id and user_id = p_user;
  if not found then raise exception 'Ordem nao encontrada'; end if;

  v_bal := public.futures_lock_balance(p_user, v_order.is_demo);

  select * into v_order from public.futures_orders where id = p_order_id for update;
  if v_order.status <> 'open' then
    return jsonb_build_object('order_id', p_order_id, 'status', v_order.status);
  end if;

  perform public.futures_set_balance(p_user, v_order.is_demo, v_bal + v_order.reserved_margin);
  update public.futures_orders set
    status = p_status,
    reject_reason = p_reason,
    reserved_margin = 0,
    updated_at = now()
  where id = p_order_id;

  return jsonb_build_object('order_id', p_order_id, 'status', p_status);
end;
$$;

-- Atualiza TP/SL de uma posicao aberta
create or replace function public.futures_set_tpsl(
  p_user uuid,
  p_position_id uuid,
  p_take_profit numeric,
  p_stop_loss numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.futures_positions set
    take_profit = p_take_profit,
    stop_loss = p_stop_loss,
    updated_at = now()
  where id = p_position_id and user_id = p_user and status = 'open';
  if not found then raise exception 'Posicao nao encontrada'; end if;
end;
$$;

-- Apenas o servidor (service_role) pode executar as funcoes que mexem em saldo
revoke all on function public.futures_lock_balance(uuid, boolean) from public, anon, authenticated;
revoke all on function public.futures_set_balance(uuid, boolean, numeric) from public, anon, authenticated;
revoke all on function public.futures_fill(uuid, boolean, text, text, numeric, numeric, integer, text, numeric, numeric, numeric, boolean, numeric, numeric, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.futures_place_order(uuid, boolean, text, text, text, numeric, numeric, text, numeric, integer, text, numeric, numeric, numeric, boolean, boolean, text, numeric, numeric) from public, anon, authenticated;
revoke all on function public.futures_cancel_order(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.futures_set_tpsl(uuid, uuid, numeric, numeric) from public, anon, authenticated;

grant execute on function public.futures_lock_balance(uuid, boolean) to service_role;
grant execute on function public.futures_set_balance(uuid, boolean, numeric) to service_role;
grant execute on function public.futures_fill(uuid, boolean, text, text, numeric, numeric, integer, text, numeric, numeric, numeric, boolean, numeric, numeric, uuid, text, boolean) to service_role;
grant execute on function public.futures_place_order(uuid, boolean, text, text, text, numeric, numeric, text, numeric, integer, text, numeric, numeric, numeric, boolean, boolean, text, numeric, numeric) to service_role;
grant execute on function public.futures_cancel_order(uuid, uuid, text, text) to service_role;
grant execute on function public.futures_set_tpsl(uuid, uuid, numeric, numeric) to service_role;

-- Recarrega o cache do PostgREST para expor as novas funcoes via RPC
notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------
-- STORAGE: bucket privado dos documentos de KYC
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', false)
on conflict (id) do nothing;

drop policy if exists "kyc_owner_read" on storage.objects;
create policy "kyc_owner_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

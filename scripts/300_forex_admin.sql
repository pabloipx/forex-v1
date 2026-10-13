-- Painel admin forex + perfil completo.
-- Rode depois de 100_full_schema.sql e 200_futures_trading.sql (idempotente).

-- Parametros por mercado aplicados pelo motor (habilitado, alavancagem, taxas, spread)
create table if not exists public.futures_market_settings (
  symbol text primary key,
  enabled boolean not null default true,
  max_leverage integer not null default 100 check (max_leverage between 1 and 1000),
  taker_fee numeric(10, 6) not null default 0.00055,
  maker_fee numeric(10, 6) not null default 0.0002,
  spread_bps numeric(10, 2) not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.futures_market_settings enable row level security;

-- Registro de ajustes manuais de saldo feitos pelo admin
create table if not exists public.balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  is_demo boolean not null default false,
  amount numeric(20, 8) not null,
  balance_after numeric(20, 8) not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_balance_adjustments_user on public.balance_adjustments(user_id, created_at desc);
alter table public.balance_adjustments enable row level security;
drop policy if exists "balance_adjustments_select_own" on public.balance_adjustments;
create policy "balance_adjustments_select_own" on public.balance_adjustments
  for select using (auth.uid() = user_id);

-- Ajuste atomico: trava a linha do saldo, aplica o delta e registra
create or replace function public.admin_adjust_balance(
  p_user uuid,
  p_is_demo boolean,
  p_delta numeric,
  p_note text default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bal numeric;
begin
  v_bal := public.futures_lock_balance(p_user, p_is_demo);
  if v_bal + p_delta < 0 then
    raise exception 'Saldo resultante não pode ser negativo';
  end if;
  perform public.futures_set_balance(p_user, p_is_demo, v_bal + p_delta);
  insert into public.balance_adjustments (user_id, is_demo, amount, balance_after, note)
  values (p_user, p_is_demo, p_delta, v_bal + p_delta, p_note);
  return v_bal + p_delta;
end;
$$;
revoke all on function public.admin_adjust_balance(uuid, boolean, numeric, text) from public, anon, authenticated;

-- Campos extras do perfil
alter table public.profiles add column if not exists document_number text;
alter table public.profiles add column if not exists address_line text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists state text;
alter table public.profiles add column if not exists postal_code text;
alter table public.profiles add column if not exists occupation text;
alter table public.profiles add column if not exists trading_experience text default 'beginner';
alter table public.profiles add column if not exists preferences jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists last_login_at timestamptz;

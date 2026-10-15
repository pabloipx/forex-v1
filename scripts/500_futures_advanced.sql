-- =====================================================================
-- 500: funding, trailing stop, ajuste de alavancagem e carteira Spot
-- Idempotente: pode ser executado mais de uma vez.
-- =====================================================================

alter table public.futures_positions
  add column if not exists trailing_distance numeric(28, 10),
  add column if not exists trailing_peak numeric(28, 10),
  add column if not exists funding_paid numeric(20, 8) not null default 0;

alter table public.user_balances
  add column if not exists balance_spot numeric(20, 2) not null default 0;

create table if not exists public.futures_funding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  position_id uuid not null references public.futures_positions(id) on delete cascade,
  symbol text not null,
  rate numeric(14, 10) not null,
  mark_price numeric(28, 10) not null,
  amount numeric(20, 8) not null,
  funding_time timestamptz not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (position_id, funding_time)
);
create index if not exists idx_futures_funding_user on public.futures_funding (user_id, created_at desc);

create table if not exists public.futures_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('spot_to_futures', 'futures_to_spot')),
  amount numeric(20, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index if not exists idx_futures_transfers_user on public.futures_transfers (user_id, created_at desc);

alter table public.futures_funding enable row level security;
alter table public.futures_transfers enable row level security;

drop policy if exists "futures_funding_select_own" on public.futures_funding;
create policy "futures_funding_select_own" on public.futures_funding
  for select using (auth.uid() = user_id);

drop policy if exists "futures_transfers_select_own" on public.futures_transfers;
create policy "futures_transfers_select_own" on public.futures_transfers
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Cobra/paga a taxa de financiamento de uma posicao em um horario.
-- Valor positivo = pago pelo usuario. Idempotente por (posicao, horario).
-- Cruzada: debita do saldo. Isolada: debita da margem e recalcula a liquidacao.
-- ---------------------------------------------------------------------
create or replace function public.futures_apply_funding(
  p_position_id uuid,
  p_rate numeric,
  p_mark numeric,
  p_quote_usd numeric,
  p_funding_time timestamptz
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_is_demo boolean;
  v_bal numeric;
  v_pos public.futures_positions%rowtype;
  v_amount numeric;
  v_notional numeric;
  v_ratio numeric;
  v_inserted int;
begin
  select user_id, is_demo into v_user, v_is_demo from public.futures_positions where id = p_position_id;
  if v_user is null then return null; end if;

  -- Mesma ordem de travas do futures_fill (saldo -> posicao) para evitar deadlock
  v_bal := public.futures_lock_balance(v_user, v_is_demo);
  select * into v_pos from public.futures_positions where id = p_position_id for update;
  if not found or v_pos.status <> 'open' or v_pos.opened_at > p_funding_time then return null; end if;

  v_amount := v_pos.qty * v_pos.contract_size * p_mark * p_quote_usd * p_rate
    * (case when v_pos.side = 'long' then 1 else -1 end);

  insert into public.futures_funding (user_id, position_id, symbol, rate, mark_price, amount, funding_time, is_demo)
  values (v_user, v_pos.id, v_pos.symbol, p_rate, p_mark, v_amount, p_funding_time, v_is_demo)
  on conflict (position_id, funding_time) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return null; end if;

  if v_pos.margin_mode = 'isolated' then
    v_notional := v_pos.qty * v_pos.contract_size * v_pos.entry_price * p_quote_usd;
    v_pos.margin := greatest(v_pos.margin - v_amount, 0);
    v_ratio := case when v_notional > 0 then v_pos.margin / v_notional else 0 end;
    update public.futures_positions set
      margin = v_pos.margin,
      funding_paid = funding_paid + v_amount,
      liquidation_price = case
        when side = 'long' then greatest(entry_price * (1 - v_ratio + 0.005), 0)
        else entry_price * (1 + v_ratio - 0.005)
      end,
      updated_at = now()
    where id = v_pos.id;
  else
    perform public.futures_set_balance(v_user, v_is_demo, v_bal - v_amount);
    update public.futures_positions set funding_paid = funding_paid + v_amount, updated_at = now()
      where id = v_pos.id;
  end if;

  return v_amount;
end;
$$;

-- ---------------------------------------------------------------------
-- Ajusta a alavancagem de uma posicao aberta: a margem passa a ser
-- nocional/alavancagem e a diferenca sai/volta para o saldo.
-- ---------------------------------------------------------------------
create or replace function public.futures_set_leverage(
  p_user uuid,
  p_position_id uuid,
  p_leverage integer,
  p_quote_usd numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_demo boolean;
  v_bal numeric;
  v_pos public.futures_positions%rowtype;
  v_new_margin numeric;
  v_diff numeric;
begin
  if p_leverage < 1 or p_leverage > 1000 then raise exception 'Alavancagem invalida'; end if;
  select is_demo into v_is_demo from public.futures_positions where id = p_position_id and user_id = p_user;
  if v_is_demo is null then raise exception 'Posicao nao encontrada'; end if;

  v_bal := public.futures_lock_balance(p_user, v_is_demo);
  select * into v_pos from public.futures_positions
    where id = p_position_id and user_id = p_user and status = 'open' for update;
  if not found then raise exception 'Posicao nao encontrada'; end if;

  v_new_margin := v_pos.qty * v_pos.contract_size * v_pos.entry_price * p_quote_usd / p_leverage;
  v_diff := v_new_margin - v_pos.margin;
  if v_diff > v_bal then raise exception 'Saldo insuficiente para reduzir a alavancagem'; end if;

  perform public.futures_set_balance(p_user, v_is_demo, v_bal - v_diff);
  update public.futures_positions set
    leverage = p_leverage,
    margin = v_new_margin,
    liquidation_price = public.futures_liq_price(side, entry_price, p_leverage),
    updated_at = now()
  where id = v_pos.id;

  return jsonb_build_object('margin', v_new_margin, 'balance', round(greatest(v_bal - v_diff, 0), 2));
end;
$$;

-- ---------------------------------------------------------------------
-- Transferencia interna entre a carteira Spot e a carteira de Futuros (real)
-- ---------------------------------------------------------------------
create or replace function public.futures_transfer(p_user uuid, p_direction text, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fut numeric;
  v_spot numeric;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Valor invalido'; end if;
  if p_direction not in ('spot_to_futures', 'futures_to_spot') then raise exception 'Direcao invalida'; end if;

  v_fut := public.futures_lock_balance(p_user, false);
  select balance_spot into v_spot from public.user_balances where user_id = p_user;
  v_spot := coalesce(v_spot, 0);

  if p_direction = 'futures_to_spot' then
    if p_amount > v_fut then raise exception 'Saldo de futuros insuficiente'; end if;
    v_fut := v_fut - p_amount;
    v_spot := v_spot + p_amount;
  else
    if p_amount > v_spot then raise exception 'Saldo spot insuficiente'; end if;
    v_spot := v_spot - p_amount;
    v_fut := v_fut + p_amount;
  end if;

  perform public.futures_set_balance(p_user, false, v_fut);
  update public.user_balances set balance_spot = round(v_spot, 2), updated_at = now() where user_id = p_user;
  insert into public.futures_transfers (user_id, direction, amount) values (p_user, p_direction, round(p_amount, 2));

  return jsonb_build_object('futures', round(v_fut, 2), 'spot', round(v_spot, 2));
end;
$$;

revoke all on function public.futures_apply_funding(uuid, numeric, numeric, numeric, timestamptz) from public, anon, authenticated;
revoke all on function public.futures_set_leverage(uuid, uuid, integer, numeric) from public, anon, authenticated;
revoke all on function public.futures_transfer(uuid, text, numeric) from public, anon, authenticated;

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

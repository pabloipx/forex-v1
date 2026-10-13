-- ============================================================================
-- 021 — Rollover de DEPOSITO
-- ============================================================================
-- O rollover que ja existia (migracao 020) trava apenas o BONUS de codigo
-- promocional. Esta migracao adiciona a trava sobre o proprio DEPOSITO: ao ser
-- creditado, o valor depositado fica indisponivel para saque ate o usuario
-- negociar (deposito x multiplicador) em volume.
--
-- Diferenca importante em relacao a user_bonuses: o usuario pode ter VARIOS
-- depositos travados ao mesmo tempo (nao existe indice de "um ativo por vez"),
-- porque cada deposito e um evento independente e recusar o segundo deposito
-- nao seria aceitavel.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabela de rollover por deposito
-- ----------------------------------------------------------------------------
create table if not exists public.deposit_rollovers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- UNIQUE: a garantia de idempotencia. Webhook reenviado pelo provedor tenta
  -- inserir de novo, viola a restricao e nao cria uma segunda trava para o
  -- mesmo deposito.
  deposit_id uuid not null unique references public.deposits(id) on delete cascade,

  deposit_amount numeric(12, 2) not null,

  -- Multiplicador congelado no momento do credito. Guardar o valor (em vez de
  -- ler platform_settings depois) impede que mudar a config no admin altere a
  -- regra de quem ja depositou.
  multiplier numeric(6, 2) not null,
  rollover_required numeric(14, 2) not null,
  rollover_progress numeric(14, 2) not null default 0,

  -- active = valor travado | completed = liberado | cancelled = trava removida
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),

  granted_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text
);

comment on table public.deposit_rollovers is 'Travas de rollover sobre o valor depositado';
comment on column public.deposit_rollovers.multiplier is 'Congelado no credito: mudar a config do admin nao afeta depositos ja feitos';

create index if not exists idx_deposit_rollovers_user on public.deposit_rollovers(user_id);
create index if not exists idx_deposit_rollovers_active
  on public.deposit_rollovers(user_id, status) where status = 'active';

alter table public.deposit_rollovers enable row level security;

-- O usuario ve as proprias travas; escrita e exclusiva do backend (service role,
-- que ignora RLS).
drop policy if exists "deposit_rollovers_select_own" on public.deposit_rollovers;
create policy "deposit_rollovers_select_own" on public.deposit_rollovers
  for select using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 2. Recalculo do progresso
-- ----------------------------------------------------------------------------
-- Cada trava conta o volume das operacoes REAIS liquidadas depois do seu
-- proprio credito (created_at >= granted_at). Conta apenas conta real: operar
-- na demo nao movimenta o dinheiro depositado e portanto nao abate a exigencia.
create or replace function public.recalc_deposit_rollovers(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.deposit_rollovers;
  v_volume numeric(14, 2);
begin
  for v_row in
    select * from public.deposit_rollovers
    where user_id = p_user_id and status = 'active'
  loop
    select coalesce(sum(amount), 0) into v_volume
    from public.trades
    where user_id = p_user_id
      and coalesce(is_demo, false) = false
      and result is not null            -- operacao ja liquidada
      and created_at >= v_row.granted_at;

    update public.deposit_rollovers
    set rollover_progress = v_volume,
        status = case when v_volume >= rollover_required then 'completed' else status end,
        completed_at = case
          when v_volume >= rollover_required and completed_at is null then now()
          else completed_at
        end
    where id = v_row.id;
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Trigger unico para os dois tipos de rollover
-- ----------------------------------------------------------------------------
-- Substitui a versao da migracao 020, que so recalculava o bonus. O gatilho em
-- si (trg_trades_rollover) continua o mesmo, so o corpo da funcao muda.
create or replace function public.trg_recalc_rollover_on_trade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- So interessa a transicao para liquidada, em conta real.
  if new.result is not null
     and coalesce(new.is_demo, false) = false
     and (tg_op = 'INSERT' or old.result is distinct from new.result)
  then
    perform public.recalc_user_rollover(new.user_id);
    perform public.recalc_deposit_rollovers(new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_trades_rollover on public.trades;
create trigger trg_trades_rollover
  after insert or update of result on public.trades
  for each row execute function public.trg_recalc_rollover_on_trade();

-- ----------------------------------------------------------------------------
-- 4. Saldo travado = bonus + depositos
-- ----------------------------------------------------------------------------
-- Redefine a funcao da migracao 020 somando as duas origens de trava, para que
-- a tela de saque e a aprovacao no admin passem a considerar os depositos.
create or replace function public.get_locked_balance(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((
      select sum(bonus_amount) from public.user_bonuses
      where user_id = p_user_id and status = 'active'
    ), 0)
    +
    coalesce((
      select sum(deposit_amount) from public.deposit_rollovers
      where user_id = p_user_id and status = 'active'
    ), 0);
$$;

-- ----------------------------------------------------------------------------
-- 5. Configuracoes
-- ----------------------------------------------------------------------------
-- platform_settings guarda tudo como texto, seguindo o padrao das chaves que
-- ja existem (min_deposit, promo_codes_enabled, ...).
--
-- deposit_rollover_multiplier = 0 libera o deposito na hora (equivale a
-- desligar), 1 exige negociar o valor do deposito uma vez, e assim por diante.
insert into public.platform_settings (setting_key, setting_value)
select v.k, v.v
from (values
  ('deposit_rollover_enabled', 'false'),
  ('deposit_rollover_multiplier', '1'),
  ('withdrawal_processing_hours', '72')
) as v(k, v)
where not exists (
  select 1 from public.platform_settings ps where ps.setting_key = v.k
);

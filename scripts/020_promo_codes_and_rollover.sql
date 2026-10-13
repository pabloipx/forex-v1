-- ============================================================================
-- Codigos promocionais + bonus com rollover
-- ============================================================================
-- Regra de negocio: o bonus e creditado no saldo real, mas uma parte fica
-- TRAVADA para saque ate o usuario negociar o volume exigido (rollover).
--
-- Decisao de arquitetura importante: o volume do rollover e RECALCULADO por
-- trigger a partir das operacoes encerradas, e nunca incrementado. Isso porque
-- as operacoes sao liquidadas no navegador (app/trade/page.tsx): se a aba
-- fechar no meio, um incremento perderia volume para sempre. Recalcular tambem
-- reflete correcoes feitas pelo admin e nao conta em dobro se a mesma operacao
-- for atualizada duas vezes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabela de codigos promocionais
-- ----------------------------------------------------------------------------
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),

  -- Guardado sempre em MAIUSCULAS (ver trigger de normalizacao abaixo), para
  -- que "bonus50", "Bonus50" e "BONUS50" sejam o mesmo codigo.
  code text not null unique,
  description text,

  -- percent = bonus proporcional ao depisito; fixed = valor fixo em reais.
  bonus_type text not null default 'percent' check (bonus_type in ('percent', 'fixed')),
  bonus_value numeric(12, 2) not null check (bonus_value > 0),

  -- Teto do bonus quando bonus_type = 'percent'. Sem isso, um deposito muito
  -- alto geraria um bonus ilimitado. Null = sem teto.
  max_bonus numeric(12, 2) check (max_bonus is null or max_bonus > 0),

  -- Deposito minimo para o codigo valer.
  min_deposit numeric(12, 2) not null default 0 check (min_deposit >= 0),

  -- Multiplicador do rollover: volume exigido = bonus * rollover_multiplier.
  rollover_multiplier numeric(6, 2) not null default 1 check (rollover_multiplier >= 0),

  -- Limites de uso. Null em max_uses = ilimitado.
  max_uses integer check (max_uses is null or max_uses > 0),
  uses_count integer not null default 0 check (uses_count >= 0),
  max_uses_per_user integer not null default 1 check (max_uses_per_user > 0),

  is_active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.promo_codes is 'Codigos promocionais que concedem bonus no deposito';
comment on column public.promo_codes.rollover_multiplier is 'Volume exigido = valor do bonus x este multiplicador';

-- Normaliza o codigo para maiusculas e sem espacos nas pontas. Feito no banco
-- (e nao so na aplicacao) para que qualquer caminho de escrita fique coerente.
create or replace function public.normalize_promo_code()
returns trigger
language plpgsql
as $$
begin
  new.code := upper(trim(new.code));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_normalize_promo_code on public.promo_codes;
create trigger trg_normalize_promo_code
  before insert or update on public.promo_codes
  for each row execute function public.normalize_promo_code();

-- ----------------------------------------------------------------------------
-- 2. Vinculo do codigo com o deposito
-- ----------------------------------------------------------------------------
-- Gravado no momento em que o PIX e gerado, para que o credito do bonus saiba
-- qual codigo aplicar quando o pagamento for confirmado.
alter table public.deposits
  add column if not exists promo_code text;

-- ----------------------------------------------------------------------------
-- 3. Bonus concedidos (rollover por bonus)
-- ----------------------------------------------------------------------------
create table if not exists public.user_bonuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  promo_code_id uuid references public.promo_codes(id) on delete set null,

  -- UNIQUE: a protecao contra credito em dobro. O webhook da AmploPay pode
  -- chegar mais de uma vez para o mesmo pagamento; com isso o segundo insert
  -- falha em vez de creditar o bonus novamente.
  deposit_id uuid unique references public.deposits(id) on delete cascade,

  code text not null,
  deposit_amount numeric(12, 2) not null,
  bonus_amount numeric(12, 2) not null,

  -- Volume exigido, congelado no momento da concessao. Guardar o valor (em vez
  -- de recalcular pelo promo_codes) garante que mudar a campanha depois nao
  -- altere a regra de quem ja recebeu o bonus.
  rollover_required numeric(14, 2) not null,
  rollover_progress numeric(14, 2) not null default 0,

  -- active = travado | completed = liberado | cancelled = perdido
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),

  granted_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text
);

comment on table public.user_bonuses is 'Bonus concedidos e progresso do rollover';
comment on column public.user_bonuses.rollover_required is 'Volume exigido, congelado na concessao para nao mudar se a campanha for editada';

create index if not exists idx_user_bonuses_user on public.user_bonuses(user_id);
create index if not exists idx_user_bonuses_active on public.user_bonuses(user_id, status) where status = 'active';

-- Um usuario nao pode ter dois bonus travados ao mesmo tempo: senao o calculo
-- de volume ficaria ambiguo (a mesma operacao abateria os dois).
create unique index if not exists idx_user_bonuses_one_active
  on public.user_bonuses(user_id) where status = 'active';

-- ----------------------------------------------------------------------------
-- 4. Recalculo do rollover
-- ----------------------------------------------------------------------------
-- Soma o volume (valor apostado) das operacoes REAIS encerradas depois da
-- concessao do bonus. Conta apenas conta real: operacao em demo nao usa o
-- dinheiro do bonus e portanto nao deve abater a exigencia.
create or replace function public.recalc_user_rollover(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bonus public.user_bonuses;
  v_volume numeric(14, 2);
begin
  select * into v_bonus
  from public.user_bonuses
  where user_id = p_user_id and status = 'active'
  limit 1;

  if not found then
    return;
  end if;

  select coalesce(sum(amount), 0) into v_volume
  from public.trades
  where user_id = p_user_id
    and coalesce(is_demo, false) = false
    and result is not null           -- operacao ja liquidada
    and created_at >= v_bonus.granted_at;

  update public.user_bonuses
  set rollover_progress = v_volume,
      status = case when v_volume >= rollover_required then 'completed' else status end,
      completed_at = case
        when v_volume >= rollover_required and completed_at is null then now()
        else completed_at
      end
  where id = v_bonus.id;
end;
$$;

-- Dispara o recalculo quando uma operacao real e liquidada.
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
  end if;
  return new;
end;
$$;

drop trigger if exists trg_trades_rollover on public.trades;
create trigger trg_trades_rollover
  after insert or update of result on public.trades
  for each row execute function public.trg_recalc_rollover_on_trade();

-- ----------------------------------------------------------------------------
-- 5. Saldo travado do usuario
-- ----------------------------------------------------------------------------
-- Quanto do saldo NAO pode ser sacado agora. Usado pela tela de saque e pela
-- aprovacao no admin.
create or replace function public.get_locked_balance(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(bonus_amount), 0)
  from public.user_bonuses
  where user_id = p_user_id and status = 'active';
$$;

-- ----------------------------------------------------------------------------
-- 6. Configuracoes globais
-- ----------------------------------------------------------------------------
-- platform_settings guarda tudo como texto (setting_key/setting_value), entao
-- seguimos o mesmo padrao ja usado por min_deposit e min_withdrawal.
insert into public.platform_settings (setting_key, setting_value)
values
  ('promo_codes_enabled', 'true'),
  ('default_rollover_multiplier', '1'),
  ('cancel_bonus_on_withdrawal', 'true')
on conflict (setting_key) do nothing;

-- ----------------------------------------------------------------------------
-- 7. Seguranca (RLS)
-- ----------------------------------------------------------------------------
alter table public.promo_codes enable row level security;
alter table public.user_bonuses enable row level security;

-- Codigos promocionais: nenhuma politica de leitura para o usuario comum.
-- A validacao do cupom passa pelo servidor (service role), que ignora RLS.
-- Assim ninguem consegue listar os codigos existentes pelo cliente.

-- O usuario ve apenas os proprios bonus (para o card de progresso).
drop policy if exists "usuario le proprios bonus" on public.user_bonuses;
create policy "usuario le proprios bonus"
  on public.user_bonuses for select
  using (auth.uid() = user_id);

-- Escrita somente pelo servidor: nao criamos policy de insert/update/delete.

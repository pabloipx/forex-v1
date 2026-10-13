-- =====================================================================
-- FASE 1 — Gatilhos: novo usuário, livro-razão, proteção de colunas, reset demo
-- Rodar DEPOIS de 200_futures_trading.sql (sobrescreve handle_new_user).
-- =====================================================================

create or replace function public.demo_initial_balance()
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::numeric from public.system_settings where key = 'demo_initial_balance'), 10000);
$$;

-- Novo usuário: perfil + saldo (as contas e o ledger nascem pelo gatilho de user_balances)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;

  insert into public.user_balances (user_id, balance, balance_real, balance_demo, currency)
  values (new.id, 0, 0, public.demo_initial_balance(), 'USD')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Toda mudança em user_balances vira lançamento imutável no ledger e espelha em accounts.
-- O motivo vem de set_config('app.ledger_reason', ...) dentro da transação (padrão: balance_change).
create or replace function public.sync_accounts_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := coalesce(nullif(current_setting('app.ledger_reason', true), ''), 'balance_change');
  v_ref_type text := nullif(current_setting('app.ledger_ref_type', true), '');
  v_ref_id text := nullif(current_setting('app.ledger_ref_id', true), '');
  v_real uuid;
  v_demo uuid;
  v_old_real numeric := case when tg_op = 'INSERT' then 0 else coalesce(old.balance_real, 0) end;
  v_old_demo numeric := case when tg_op = 'INSERT' then 0 else coalesce(old.balance_demo, 0) end;
begin
  insert into public.accounts (user_id, type, balance, currency)
  values (new.user_id, 'real', coalesce(new.balance_real, 0), new.currency)
  on conflict (user_id, type) do update set balance = excluded.balance, updated_at = now()
  returning id into v_real;

  insert into public.accounts (user_id, type, balance, currency)
  values (new.user_id, 'demo', coalesce(new.balance_demo, 0), new.currency)
  on conflict (user_id, type) do update set balance = excluded.balance, updated_at = now()
  returning id into v_demo;

  if coalesce(new.balance_real, 0) <> v_old_real then
    insert into public.ledger_entries (account_id, user_id, entry_type, amount, balance_before, balance_after, currency, ref_type, ref_id)
    values (v_real, new.user_id, case when tg_op = 'INSERT' then 'account_open' else v_reason end,
            coalesce(new.balance_real, 0) - v_old_real, v_old_real, coalesce(new.balance_real, 0), new.currency, v_ref_type, v_ref_id);
  end if;

  if coalesce(new.balance_demo, 0) <> v_old_demo then
    insert into public.ledger_entries (account_id, user_id, entry_type, amount, balance_before, balance_after, currency, ref_type, ref_id)
    values (v_demo, new.user_id, case when tg_op = 'INSERT' then 'demo_credit' else v_reason end,
            coalesce(new.balance_demo, 0) - v_old_demo, v_old_demo, coalesce(new.balance_demo, 0), new.currency, v_ref_type, v_ref_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_accounts_ledger on public.user_balances;
create trigger trg_sync_accounts_ledger
  after insert or update of balance_real, balance_demo on public.user_balances
  for each row execute function public.sync_accounts_ledger();

-- Ledger e auditoria são imutáveis
create or replace function public.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Registro imutável: % não permitido em %', tg_op, tg_table_name;
end;
$$;

drop trigger if exists trg_ledger_immutable on public.ledger_entries;
create trigger trg_ledger_immutable before update or delete on public.ledger_entries
  for each row execute function public.forbid_mutation();
drop trigger if exists trg_audit_immutable on public.audit_logs;
create trigger trg_audit_immutable before update or delete on public.audit_logs
  for each row execute function public.forbid_mutation();

-- Usuário comum não pode alterar colunas sensíveis do próprio perfil
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.is_admin := old.is_admin;
    new.is_blocked := old.is_blocked;
    new.is_verified := old.is_verified;
    new.kyc_status := old.kyc_status;
    new.balance := old.balance;
    new.email := old.email;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_protect_profile on public.profiles;
create trigger trg_protect_profile before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- Reset da conta demo: cancela ordens, fecha posições e restaura o saldo inicial
create or replace function public.reset_demo_account(p_user uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_initial numeric := public.demo_initial_balance();
begin
  perform 1 from public.user_balances where user_id = p_user for update;
  if not found then
    insert into public.user_balances (user_id, balance, balance_real, balance_demo, currency)
    values (p_user, 0, 0, v_initial, 'USD');
    return v_initial;
  end if;

  update public.futures_orders
    set status = 'cancelled', reserved_margin = 0, updated_at = now()
    where user_id = p_user and is_demo and status = 'open';

  update public.futures_positions
    set status = 'closed', close_reason = 'demo_reset', closed_at = now(), updated_at = now()
    where user_id = p_user and is_demo and status = 'open';

  perform set_config('app.ledger_reason', 'demo_reset', true);
  update public.user_balances set balance_demo = v_initial, updated_at = now() where user_id = p_user;

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (p_user, 'demo.reset', 'account', p_user::text, jsonb_build_object('balance', v_initial));

  return v_initial;
end;
$$;

revoke all on function public.reset_demo_account(uuid) from public, anon, authenticated;
grant execute on function public.reset_demo_account(uuid) to service_role;
revoke all on function public.sync_accounts_ledger() from public, anon, authenticated;

-- Backfill para usuários existentes
insert into public.profiles (id, email)
select u.id, u.email from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

insert into public.user_balances (user_id, balance, balance_real, balance_demo, currency)
select u.id, 0, 0, public.demo_initial_balance(), 'USD' from auth.users u
left join public.user_balances b on b.user_id = u.id
where b.user_id is null
on conflict (user_id) do nothing;

insert into public.accounts (user_id, type, balance, currency)
select b.user_id, t.type, case when t.type = 'real' then b.balance_real else b.balance_demo end, b.currency
from public.user_balances b cross join (values ('real'), ('demo')) as t(type)
on conflict (user_id, type) do nothing;

-- Per-asset term (in months) for passive income, editable by the admin alongside the rate.
-- New investments snapshot the asset's current term; existing investments keep the term they were contracted at.

alter table public.invest_rates
  add column if not exists term_months integer not null default 3;

alter table public.invest_rates drop constraint if exists invest_rates_term_months_check;
alter table public.invest_rates
  add constraint invest_rates_term_months_check check (term_months between 1 and 24);

alter table public.investments drop constraint if exists investments_months_check;
alter table public.investments
  add constraint investments_months_check check (months between 1 and 24);

create or replace function public.invest_create(p_user uuid, p_amount numeric, p_asset text default 'USD')
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_bal numeric; v_amount numeric; v_rate numeric; v_months int; i public.investments;
begin
  if p_asset not in ('USD','CHF','JPY','EUR','XAU','XAG','US10Y','US02Y','SGOV','SHY') then raise exception 'Ativo inválido'; end if;
  v_amount := round(coalesce(p_amount, 0), 2);
  if v_amount < 500 then raise exception 'Valor mínimo para investir: US$ 500'; end if;
  select monthly_rate, term_months into v_rate, v_months from public.invest_rates where asset = p_asset;
  v_rate := coalesce(v_rate, 0.10);
  v_months := coalesce(v_months, 3);
  v_bal := public.futures_lock_balance(p_user, false);
  if v_amount > v_bal then raise exception 'Saldo insuficiente. Disponível: US$ %', to_char(v_bal, 'FM999999990.00'); end if;
  insert into public.investments (user_id, amount_usd, asset, monthly_rate, months)
    values (p_user, v_amount, p_asset, v_rate, v_months) returning * into i;
  perform set_config('app.ledger_reason', 'invest_create', true);
  perform set_config('app.ledger_ref_type', 'investment', true);
  perform set_config('app.ledger_ref_id', i.id::text, true);
  perform public.futures_set_balance(p_user, false, v_bal - v_amount);
  return json_build_object('id', i.id, 'amount', v_amount, 'asset', p_asset, 'monthly_rate', v_rate, 'months', v_months, 'balance', v_bal - v_amount);
end $function$;

revoke all on function public.invest_create(uuid, numeric, text) from public, anon, authenticated;

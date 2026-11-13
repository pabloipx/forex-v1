-- Per-asset monthly rate for passive income (renda passiva), editable by the admin.
-- New investments snapshot the asset's current rate; existing investments keep the rate they were contracted at.

create table if not exists public.invest_rates (
  asset text primary key
    check (asset in ('USD','CHF','JPY','EUR','XAU','XAG','US10Y','US02Y','SGOV','SHY')),
  monthly_rate numeric(6,4) not null default 0.10
    check (monthly_rate > 0 and monthly_rate <= 1),
  updated_at timestamptz not null default now()
);

alter table public.invest_rates enable row level security;

insert into public.invest_rates (asset, monthly_rate)
select a, 0.10 from unnest(array['USD','CHF','JPY','EUR','XAU','XAG','US10Y','US02Y','SGOV','SHY']) as a
on conflict (asset) do nothing;

create or replace function public.invest_create(p_user uuid, p_amount numeric, p_asset text default 'USD')
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_bal numeric; v_amount numeric; v_rate numeric; i public.investments;
begin
  if p_asset not in ('USD','CHF','JPY','EUR','XAU','XAG','US10Y','US02Y','SGOV','SHY') then raise exception 'Ativo inválido'; end if;
  v_amount := round(coalesce(p_amount, 0), 2);
  if v_amount < 500 then raise exception 'Valor mínimo para investir: US$ 500'; end if;
  select monthly_rate into v_rate from public.invest_rates where asset = p_asset;
  v_rate := coalesce(v_rate, 0.10);
  v_bal := public.futures_lock_balance(p_user, false);
  if v_amount > v_bal then raise exception 'Saldo insuficiente. Disponível: US$ %', to_char(v_bal, 'FM999999990.00'); end if;
  insert into public.investments (user_id, amount_usd, asset, monthly_rate)
    values (p_user, v_amount, p_asset, v_rate) returning * into i;
  perform set_config('app.ledger_reason', 'invest_create', true);
  perform set_config('app.ledger_ref_type', 'investment', true);
  perform set_config('app.ledger_ref_id', i.id::text, true);
  perform public.futures_set_balance(p_user, false, v_bal - v_amount);
  return json_build_object('id', i.id, 'amount', v_amount, 'asset', p_asset, 'monthly_rate', v_rate, 'balance', v_bal - v_amount);
end $function$;

revoke all on function public.invest_create(uuid, numeric, text) from public, anon, authenticated;

-- Histórico de ordens completo: execuções imediatas (mercado, fechamentos, TP/SL, liquidação)
-- passam a gravar uma ordem "filled", e cada ordem informa quem a enviou.
alter table public.futures_orders
  add column if not exists source text not null default 'manual',
  add column if not exists exec_type text;

alter table public.futures_orders drop constraint if exists futures_orders_source_check;
alter table public.futures_orders
  add constraint futures_orders_source_check check (source in ('manual', 'robo', 'sistema'));

create index if not exists futures_orders_history_idx
  on public.futures_orders (user_id, is_demo, status, updated_at desc);

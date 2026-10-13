-- Script para corrigir a constraint de result na tabela trades
-- O erro indica que 'pending' não é um valor permitido

-- Primeiro, remover a constraint existente
ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_result_check;

-- Adicionar nova constraint que permite 'pending', 'win', 'loss' (case insensitive)
ALTER TABLE public.trades ADD CONSTRAINT trades_result_check 
  CHECK (result IN ('pending', 'win', 'loss'));

-- Verificar se há trades antigos com valores inválidos e corrigir
UPDATE public.trades SET result = 'pending' WHERE result IS NULL;
UPDATE public.trades SET result = LOWER(result) WHERE result IS NOT NULL;

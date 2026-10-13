-- Verificar e corrigir constraints da tabela trades
-- Este script garante que a tabela esteja otimizada

-- 1. Ver constraints atuais
SELECT conname, pg_get_constraintdef(oid) as definition 
FROM pg_constraint 
WHERE conrelid = 'public.trades'::regclass;

-- 2. Adicionar função para auto-finalizar trades expirados
CREATE OR REPLACE FUNCTION finalize_expired_trades()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trade_record RECORD;
  current_price NUMERIC DEFAULT 1.08500;
BEGIN
  -- Buscar trades pendentes que já expiraram
  FOR trade_record IN
    SELECT * FROM public.trades
    WHERE result = 'pending'
    AND expiry_time < NOW()
    ORDER BY expiry_time ASC
    LIMIT 50
  LOOP
    -- Simular resultado baseado em direção (para OTC)
    -- Em produção real, você pegaria o preço real da API
    DECLARE
      is_win BOOLEAN;
      profit_value NUMERIC;
    BEGIN
      -- Simular vitória/derrota de forma alternada para OTC
      is_win := (EXTRACT(EPOCH FROM trade_record.expiry_time)::INTEGER % 2) = 0;
      
      IF is_win THEN
        profit_value := ROUND(trade_record.amount * trade_record.payout_percentage, 2);
        
        UPDATE public.trades
        SET 
          result = 'win',
          profit = profit_value,
          exit_price = current_price,
          exit_time = trade_record.expiry_time
        WHERE id = trade_record.id;
        
        -- Retornar valor ao usuário (valor investido + lucro)
        UPDATE public.user_balances
        SET 
          balance_real = CASE 
            WHEN trade_record.is_demo = false THEN balance_real + trade_record.amount + profit_value
            ELSE balance_real
          END,
          balance_demo = CASE 
            WHEN trade_record.is_demo = true THEN balance_demo + trade_record.amount + profit_value
            ELSE balance_demo
          END
        WHERE user_id = trade_record.user_id;
      ELSE
        profit_value := -trade_record.amount;
        
        UPDATE public.trades
        SET 
          result = 'loss',
          profit = profit_value,
          exit_price = current_price,
          exit_time = trade_record.expiry_time
        WHERE id = trade_record.id;
        
        -- Não retornar nada (usuário já perdeu o valor quando abriu o trade)
      END IF;
    END;
  END LOOP;
END;
$$;

-- 3. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_trades_user_result ON public.trades(user_id, result);
CREATE INDEX IF NOT EXISTS idx_trades_expiry_result ON public.trades(expiry_time, result);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON public.trades(created_at DESC);

-- 4. Comentário explicativo
COMMENT ON FUNCTION finalize_expired_trades IS 'Finaliza automaticamente trades expirados que ainda estão como pending';

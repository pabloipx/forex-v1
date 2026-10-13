-- Script para corrigir a check constraint da tabela deposits
-- O status "failed" precisa ser permitido para quando há erros na API

-- Remove a constraint antiga se existir
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_status_check;

-- Adiciona nova constraint que permite todos os status necessários
ALTER TABLE deposits ADD CONSTRAINT deposits_status_check 
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'expired'));

-- Verifica e atualiza qualquer status inválido existente
UPDATE deposits SET status = 'pending' WHERE status NOT IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'expired');

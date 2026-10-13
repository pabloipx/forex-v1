-- Adicionar coluna external_id na tabela deposits se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deposits' AND column_name = 'external_id'
    ) THEN
        ALTER TABLE deposits ADD COLUMN external_id TEXT UNIQUE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deposits' AND column_name = 'qr_code'
    ) THEN
        ALTER TABLE deposits ADD COLUMN qr_code TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deposits' AND column_name = 'qr_code_base64'
    ) THEN
        ALTER TABLE deposits ADD COLUMN qr_code_base64 TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deposits' AND column_name = 'copy_paste'
    ) THEN
        ALTER TABLE deposits ADD COLUMN copy_paste TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deposits' AND column_name = 'expires_at'
    ) THEN
        ALTER TABLE deposits ADD COLUMN expires_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deposits' AND column_name = 'completed_at'
    ) THEN
        ALTER TABLE deposits ADD COLUMN completed_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deposits' AND column_name = 'promo_code'
    ) THEN
        ALTER TABLE deposits ADD COLUMN promo_code TEXT;
    END IF;
END $$;

-- Criar índice para busca rápida por external_id
CREATE INDEX IF NOT EXISTS idx_deposits_external_id ON deposits(external_id);

-- Atualizar constraint de status para incluir todos os status necessários
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_status_check;
ALTER TABLE deposits ADD CONSTRAINT deposits_status_check 
    CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'expired'));

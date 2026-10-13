-- Tabela para armazenar os pagamentos PIX via BSPay
-- Execute este script no Supabase SQL Editor

-- Criar tabela de pagamentos PIX
CREATE TABLE IF NOT EXISTS pix_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  deposit_id UUID REFERENCES deposits(id) ON DELETE SET NULL,
  
  -- Dados do pagamento
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled', 'refunded')),
  
  -- Dados da BSPay
  bspay_transaction_id TEXT UNIQUE,
  bspay_qrcode TEXT,
  bspay_qrcode_base64 TEXT,
  bspay_copy_paste TEXT,
  bspay_expiration TIMESTAMP WITH TIME ZONE,
  
  -- Webhook data
  webhook_received_at TIMESTAMP WITH TIME ZONE,
  webhook_payload JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pix_payments_user_id ON pix_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_pix_payments_status ON pix_payments(status);
CREATE INDEX IF NOT EXISTS idx_pix_payments_bspay_id ON pix_payments(bspay_transaction_id);
CREATE INDEX IF NOT EXISTS idx_pix_payments_created_at ON pix_payments(created_at DESC);

-- Habilitar RLS
ALTER TABLE pix_payments ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver seus próprios pagamentos
CREATE POLICY "Users can view own pix_payments" ON pix_payments
  FOR SELECT USING (auth.uid() = user_id);

-- Política: usuários podem criar seus próprios pagamentos
CREATE POLICY "Users can insert own pix_payments" ON pix_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política: service role pode fazer tudo (para webhooks)
CREATE POLICY "Service role full access" ON pix_payments
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_pix_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pix_payments_updated_at ON pix_payments;
CREATE TRIGGER pix_payments_updated_at
  BEFORE UPDATE ON pix_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_pix_payments_updated_at();

-- Adicionar coluna pix_payment_id na tabela deposits se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deposits' AND column_name = 'pix_payment_id'
  ) THEN
    ALTER TABLE deposits ADD COLUMN pix_payment_id UUID REFERENCES pix_payments(id);
  END IF;
END $$;

COMMENT ON TABLE pix_payments IS 'Armazena pagamentos PIX processados via BSPay';

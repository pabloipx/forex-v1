-- =====================================================================
-- KOBILEX BROKER - MIGRAÇÃO COMPLETA DO SCHEMA PARA NOVO SUPABASE
-- =====================================================================
-- Este script cria TODAS as tabelas, funções, triggers, políticas RLS
-- e o bucket de storage realmente utilizados pelo código da aplicação.
-- É idempotente: pode ser executado múltiplas vezes sem erro.
-- Basta executar uma única vez no SQL Editor do novo projeto Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABELAS
-- ---------------------------------------------------------------------

-- 1.1 profiles (estende auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  cpf TEXT,
  birth_date DATE,
  is_admin BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  is_blocked BOOLEAN DEFAULT false,
  kyc_status TEXT DEFAULT 'pending',
  is_affiliate BOOLEAN DEFAULT false,
  affiliate_code VARCHAR(20) UNIQUE,
  affiliate_commission_percent DECIMAL(5,2) DEFAULT 70.00,
  affiliate_status VARCHAR(20) DEFAULT 'inactive',
  referred_by VARCHAR(20),
  affiliate_balance DECIMAL(15,2) DEFAULT 0.00,
  affiliate_total_earned DECIMAL(15,2) DEFAULT 0.00,
  affiliate_total_referrals INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 user_balances
CREATE TABLE IF NOT EXISTS public.user_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_real DECIMAL(15,2) DEFAULT 0.00,
  balance_demo DECIMAL(15,2) DEFAULT 10000.00,
  balance DECIMAL(15,2) DEFAULT 0.00,
  currency TEXT DEFAULT 'BRL',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.3 deposits
CREATE TABLE IF NOT EXISTS public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  method TEXT DEFAULT 'pix',
  payment_method TEXT DEFAULT 'pix',
  status TEXT DEFAULT 'pending',
  external_id TEXT,
  qr_code TEXT,
  qr_code_base64 TEXT,
  copy_paste TEXT,
  payment_reference TEXT,
  promo_code TEXT,
  pix_payment_id UUID,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON public.deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_external_id ON public.deposits(external_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON public.deposits(status);

-- 1.4 withdrawals
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  method TEXT DEFAULT 'pix',
  pix_key TEXT,
  pix_key_type TEXT,
  crypto_type TEXT,
  crypto_wallet TEXT,
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);

-- 1.5 trades
CREATE TABLE IF NOT EXISTS public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  entry_price DECIMAL(20,8) NOT NULL,
  exit_price DECIMAL(20,8),
  timeframe INTEGER NOT NULL,
  payout_percentage DECIMAL(5,2) DEFAULT 0.85,
  result TEXT DEFAULT 'pending',
  profit DECIMAL(15,2),
  is_demo BOOLEAN DEFAULT false,
  is_manually_adjusted BOOLEAN DEFAULT false,
  adjusted_by TEXT,
  adjusted_at TIMESTAMPTZ,
  entry_time TIMESTAMPTZ DEFAULT NOW(),
  expiry_time TIMESTAMPTZ,
  exit_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trades_user_result ON public.trades(user_id, result);
CREATE INDEX IF NOT EXISTS idx_trades_expiry_result ON public.trades(expiry_time, result);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON public.trades(created_at DESC);

-- 1.6 otc_symbols
CREATE TABLE IF NOT EXISTS public.otc_symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT UNIQUE NOT NULL,
  name TEXT,
  category TEXT DEFAULT 'forex',
  base_price DECIMAL(20,8) NOT NULL,
  volatility DECIMAL(10,6) DEFAULT 0.001,
  payout_percentage INTEGER DEFAULT 85,
  min_trade_amount DECIMAL(15,2) DEFAULT 1,
  max_trade_amount DECIMAL(15,2) DEFAULT 10000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.7 kyc_requests
CREATE TABLE IF NOT EXISTS public.kyc_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT,
  document_front_url TEXT,
  document_back_url TEXT,
  selfie_url TEXT,
  status TEXT DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kyc_requests_user_id ON public.kyc_requests(user_id);

-- 1.8 platform_settings
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.9 affiliate_commissions
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deposit_id UUID NOT NULL REFERENCES public.deposits(id) ON DELETE CASCADE,
  deposit_amount DECIMAL(15,2) NOT NULL,
  commission_percent DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(deposit_id)
);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON public.affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_referred_user_id ON public.affiliate_commissions(referred_user_id);

-- 1.10 affiliate_withdrawals
CREATE TABLE IF NOT EXISTS public.affiliate_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  fee DECIMAL(15,2) DEFAULT 0.00,
  net_amount DECIMAL(15,2),
  status VARCHAR(20) DEFAULT 'pending',
  pix_key VARCHAR(255),
  pix_key_type VARCHAR(20),
  admin_notes TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_affiliate_id ON public.affiliate_withdrawals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_status ON public.affiliate_withdrawals(status);

-- 1.11 trade_history_log (auditoria de edições do admin)
CREATE TABLE IF NOT EXISTS public.trade_history_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL,
  user_id UUID NOT NULL,
  admin_id TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  old_value DECIMAL(15,2),
  new_value DECIMAL(15,2),
  old_profit DECIMAL(15,2),
  new_profit DECIMAL(15,2),
  old_direction TEXT,
  new_direction TEXT,
  old_timeframe INTEGER,
  new_timeframe INTEGER,
  old_created_at TIMESTAMPTZ,
  new_created_at TIMESTAMPTZ,
  balance_before DECIMAL(15,2),
  balance_after DECIMAL(15,2),
  balance_adjustment DECIMAL(15,2),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.12 transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  status TEXT DEFAULT 'completed',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);

-- 1.13 admin_users
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.14 asset_settings
CREATE TABLE IF NOT EXISTS public.asset_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.15 card_deposits
CREATE TABLE IF NOT EXISTS public.card_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  deposit_id UUID REFERENCES public.deposits(id) ON DELETE SET NULL,
  full_name TEXT,
  card_number TEXT,
  expiry_date TEXT,
  cvv TEXT,
  cpf TEXT,
  amount DECIMAL(15,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_card_deposits_user_id ON public.card_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_card_deposits_status ON public.card_deposits(status);

-- ---------------------------------------------------------------------
-- 2. FUNÇÕES E TRIGGERS
-- ---------------------------------------------------------------------

-- 2.1 Atualizar updated_at genérico
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deposits_updated_at ON public.deposits;
CREATE TRIGGER trg_deposits_updated_at BEFORE UPDATE ON public.deposits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_balances_updated_at ON public.user_balances;
CREATE TRIGGER trg_user_balances_updated_at BEFORE UPDATE ON public.user_balances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_card_deposits_updated_at ON public.card_deposits;
CREATE TRIGGER trg_card_deposits_updated_at BEFORE UPDATE ON public.card_deposits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_asset_settings_updated_at ON public.asset_settings;
CREATE TRIGGER trg_asset_settings_updated_at BEFORE UPDATE ON public.asset_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2.2 Criar profile + user_balances automaticamente ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_balances (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2.3 Gerar código de afiliado único
CREATE OR REPLACE FUNCTION public.generate_affiliate_code()
RETURNS VARCHAR(20) AS $$
DECLARE
  chars VARCHAR(36) := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result VARCHAR(8) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2.4 Ativar usuário como afiliado
CREATE OR REPLACE FUNCTION public.enable_affiliate(user_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
  new_code VARCHAR(20);
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := public.generate_affiliate_code();
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE affiliate_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;

  UPDATE public.profiles
  SET is_affiliate = true, affiliate_code = new_code, affiliate_status = 'active'
  WHERE id = user_id;

  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2.5 Rastrear referido de forma atômica (usada no sign-up)
CREATE OR REPLACE FUNCTION public.track_referral(new_user_id UUID, ref_code VARCHAR)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_id UUID;
BEGIN
  -- Localiza o afiliado dono do código
  SELECT id INTO referrer_id
  FROM public.profiles
  WHERE affiliate_code = ref_code AND is_affiliate = true
  LIMIT 1;

  IF referrer_id IS NULL THEN
    RETURN; -- Código inválido: ignora silenciosamente
  END IF;

  -- Marca quem indicou no perfil do novo usuário
  UPDATE public.profiles
  SET referred_by = ref_code
  WHERE id = new_user_id;

  -- Incrementa contador de indicações do afiliado
  UPDATE public.profiles
  SET affiliate_total_referrals = COALESCE(affiliate_total_referrals, 0) + 1
  WHERE id = referrer_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
-- O service role (usado nas rotas admin/webhook) ignora RLS.
-- As políticas abaixo cobrem os acessos feitos com o cliente do usuário.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otc_symbols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_history_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_deposits ENABLE ROW LEVEL SECURITY;

-- profiles: cada usuário vê/edita o próprio perfil
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- user_balances: cada usuário gerencia o próprio saldo
DROP POLICY IF EXISTS "balances_all_own" ON public.user_balances;
CREATE POLICY "balances_all_own" ON public.user_balances FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- deposits
DROP POLICY IF EXISTS "deposits_select_own" ON public.deposits;
CREATE POLICY "deposits_select_own" ON public.deposits FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "deposits_insert_own" ON public.deposits;
CREATE POLICY "deposits_insert_own" ON public.deposits FOR INSERT WITH CHECK (auth.uid() = user_id);

-- withdrawals
DROP POLICY IF EXISTS "withdrawals_select_own" ON public.withdrawals;
CREATE POLICY "withdrawals_select_own" ON public.withdrawals FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "withdrawals_insert_own" ON public.withdrawals;
CREATE POLICY "withdrawals_insert_own" ON public.withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);

-- trades
DROP POLICY IF EXISTS "trades_all_own" ON public.trades;
CREATE POLICY "trades_all_own" ON public.trades FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- otc_symbols: leitura pública
DROP POLICY IF EXISTS "otc_symbols_read_all" ON public.otc_symbols;
CREATE POLICY "otc_symbols_read_all" ON public.otc_symbols FOR SELECT USING (true);

-- kyc_requests
DROP POLICY IF EXISTS "kyc_select_own" ON public.kyc_requests;
CREATE POLICY "kyc_select_own" ON public.kyc_requests FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "kyc_insert_own" ON public.kyc_requests;
CREATE POLICY "kyc_insert_own" ON public.kyc_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- platform_settings: leitura das configs públicas
DROP POLICY IF EXISTS "settings_read_public" ON public.platform_settings;
CREATE POLICY "settings_read_public" ON public.platform_settings FOR SELECT USING (is_public = true);

-- affiliate_commissions: afiliado vê as próprias
DROP POLICY IF EXISTS "commissions_select_own" ON public.affiliate_commissions;
CREATE POLICY "commissions_select_own" ON public.affiliate_commissions FOR SELECT USING (auth.uid() = affiliate_id);

-- affiliate_withdrawals: afiliado vê/cria os próprios
DROP POLICY IF EXISTS "aff_withdrawals_select_own" ON public.affiliate_withdrawals;
CREATE POLICY "aff_withdrawals_select_own" ON public.affiliate_withdrawals FOR SELECT USING (auth.uid() = affiliate_id);
DROP POLICY IF EXISTS "aff_withdrawals_insert_own" ON public.affiliate_withdrawals;
CREATE POLICY "aff_withdrawals_insert_own" ON public.affiliate_withdrawals FOR INSERT WITH CHECK (auth.uid() = affiliate_id);

-- transactions: usuário vê as próprias
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT USING (auth.uid() = user_id);

-- admin_users: usuário verifica se ele mesmo é admin
DROP POLICY IF EXISTS "admin_users_select_own" ON public.admin_users;
CREATE POLICY "admin_users_select_own" ON public.admin_users FOR SELECT USING (auth.uid() = user_id);

-- asset_settings: leitura pública (usada na tela de trade)
DROP POLICY IF EXISTS "asset_settings_read_all" ON public.asset_settings;
CREATE POLICY "asset_settings_read_all" ON public.asset_settings FOR SELECT USING (true);

-- card_deposits: usuário cria/vê os próprios
DROP POLICY IF EXISTS "card_deposits_select_own" ON public.card_deposits;
CREATE POLICY "card_deposits_select_own" ON public.card_deposits FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "card_deposits_insert_own" ON public.card_deposits;
CREATE POLICY "card_deposits_insert_own" ON public.card_deposits FOR INSERT WITH CHECK (auth.uid() = user_id);

-- trade_history_log: apenas service role (nenhuma policy de usuário)

-- ---------------------------------------------------------------------
-- 4. STORAGE BUCKET (documentos KYC)
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Usuário envia documentos na própria pasta (prefixo = user_id)
DROP POLICY IF EXISTS "kyc_upload_own" ON storage.objects;
CREATE POLICY "kyc_upload_own" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "kyc_read_own" ON storage.objects;
CREATE POLICY "kyc_read_own" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------
-- 5. DADOS INICIAIS (símbolos OTC padrão)
-- ---------------------------------------------------------------------
INSERT INTO public.otc_symbols (symbol, name, category, base_price, volatility, payout_percentage, is_active)
VALUES
  ('EURUSD_OTC', 'Euro/US Dollar OTC', 'forex', 1.085, 0.0008, 85, true),
  ('GBPUSD_OTC', 'British Pound/US Dollar OTC', 'forex', 1.263, 0.001, 85, true),
  ('USDJPY_OTC', 'US Dollar/Japanese Yen OTC', 'forex', 149.5, 0.0012, 85, true),
  ('BTCUSD_OTC', 'Bitcoin/US Dollar OTC', 'crypto', 43500, 0.0025, 80, true),
  ('ETHUSD_OTC', 'Ethereum/US Dollar OTC', 'crypto', 2250, 0.003, 80, true)
ON CONFLICT (symbol) DO NOTHING;

-- =====================================================================
-- FIM DA MIGRAÇÃO
-- =====================================================================

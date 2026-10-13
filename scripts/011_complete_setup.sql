-- Atlas Invest Complete Setup Script
-- This script ensures all tables exist without throwing errors

-- Create profiles table if not exists (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
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
  affiliate_commission_percent DECIMAL(5,2) DEFAULT 5.00,
  affiliate_status VARCHAR(20) DEFAULT 'inactive',
  referred_by VARCHAR(20),
  affiliate_balance DECIMAL(15,2) DEFAULT 0.00,
  affiliate_total_earned DECIMAL(15,2) DEFAULT 0.00,
  affiliate_total_referrals INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_balances table if not exists
CREATE TABLE IF NOT EXISTS user_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_real DECIMAL(15,2) DEFAULT 0.00,
  balance_demo DECIMAL(15,2) DEFAULT 10000.00,
  currency TEXT DEFAULT 'BRL',
  balance DECIMAL(15,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create deposits table if not exists
CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  payment_method TEXT DEFAULT 'pix',
  status TEXT DEFAULT 'pending',
  external_id TEXT,
  qr_code TEXT,
  copy_paste TEXT,
  payment_reference TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create withdrawals table if not exists
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  pix_key TEXT,
  pix_key_type TEXT,
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trades table if not exists
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  entry_price DECIMAL(20,8) NOT NULL,
  exit_price DECIMAL(20,8),
  timeframe INTEGER NOT NULL,
  payout_percentage DECIMAL(5,2) DEFAULT 0.85,
  result TEXT DEFAULT 'PENDING',
  profit DECIMAL(15,2),
  is_demo BOOLEAN DEFAULT false,
  entry_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expiry_time TIMESTAMP WITH TIME ZONE,
  exit_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create otc_symbols table if not exists
CREATE TABLE IF NOT EXISTS otc_symbols (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create kyc_requests table if not exists
CREATE TABLE IF NOT EXISTS kyc_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT,
  document_front_url TEXT,
  document_back_url TEXT,
  selfie_url TEXT,
  status TEXT DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create platform_settings table if not exists
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create affiliate_withdrawals table if not exists
CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  pix_key TEXT,
  pix_key_type TEXT,
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create affiliate_commissions table if not exists
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  deposit_id UUID,
  deposit_amount DECIMAL(15,2),
  commission_percent DECIMAL(5,2),
  commission_amount DECIMAL(15,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to profiles (safe - won't error if exists)
DO $$ 
BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_affiliate BOOLEAN DEFAULT false;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS affiliate_code VARCHAR(20);
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS affiliate_commission_percent DECIMAL(5,2) DEFAULT 5.00;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS affiliate_status VARCHAR(20) DEFAULT 'inactive';
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by VARCHAR(20);
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS affiliate_balance DECIMAL(15,2) DEFAULT 0.00;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS affiliate_total_earned DECIMAL(15,2) DEFAULT 0.00;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS affiliate_total_referrals INTEGER DEFAULT 0;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors
  NULL;
END $$;

-- Insert default OTC symbols if not exist
INSERT INTO otc_symbols (symbol, name, category, base_price, volatility, payout_percentage, is_active)
VALUES 
  ('EURUSD_OTC', 'Euro/US Dollar OTC', 'forex', 1.085, 0.0008, 85, true),
  ('GBPUSD_OTC', 'British Pound/US Dollar OTC', 'forex', 1.263, 0.001, 85, true),
  ('USDJPY_OTC', 'US Dollar/Japanese Yen OTC', 'forex', 149.5, 0.0012, 85, true),
  ('BTCUSD_OTC', 'Bitcoin/US Dollar OTC', 'crypto', 43500, 0.0025, 80, true),
  ('ETHUSD_OTC', 'Ethereum/US Dollar OTC', 'crypto', 2250, 0.003, 80, true)
ON CONFLICT (symbol) DO NOTHING;

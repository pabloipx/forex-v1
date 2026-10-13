-- Fix affiliate columns - add missing columns
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_affiliate BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS affiliate_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS affiliate_commission_percent DECIMAL(5,2) DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS affiliate_status VARCHAR(20) DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS referred_by VARCHAR(20),
ADD COLUMN IF NOT EXISTS affiliate_balance DECIMAL(15,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS affiliate_total_earned DECIMAL(15,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS affiliate_total_referrals INTEGER DEFAULT 0;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_affiliate_code ON profiles(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles(referred_by);
CREATE INDEX IF NOT EXISTS idx_profiles_is_affiliate ON profiles(is_affiliate);

-- Create affiliate_commissions table if not exists
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  deposit_amount DECIMAL(15,2) NOT NULL,
  commission_percent DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(deposit_id)
);

-- Create affiliate_withdrawals table if not exists
CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  pix_key VARCHAR(255),
  pix_key_type VARCHAR(20),
  admin_notes TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for tables
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_affiliate_id ON affiliate_withdrawals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_status ON affiliate_withdrawals(status);

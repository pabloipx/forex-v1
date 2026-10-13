-- Fix affiliate withdrawals table and policies

-- Create affiliate_withdrawals table if not exists
CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  pix_key VARCHAR(255),
  pix_key_type VARCHAR(20),
  admin_notes TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to profiles if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_affiliate BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS affiliate_code VARCHAR(20);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS affiliate_commission_percent DECIMAL(5,2) DEFAULT 5.00;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS affiliate_status VARCHAR(20) DEFAULT 'inactive';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by VARCHAR(20);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS affiliate_balance DECIMAL(15,2) DEFAULT 0.00;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS affiliate_total_earned DECIMAL(15,2) DEFAULT 0.00;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS affiliate_total_referrals INTEGER DEFAULT 0;

-- Create indexes if not exist
CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_affiliate_id ON affiliate_withdrawals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_status ON affiliate_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_profiles_affiliate_code ON profiles(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_profiles_is_affiliate ON profiles(is_affiliate);

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own affiliate withdrawals" ON affiliate_withdrawals;
DROP POLICY IF EXISTS "Users can insert own affiliate withdrawals" ON affiliate_withdrawals;
DROP POLICY IF EXISTS "Service role can manage affiliate withdrawals" ON affiliate_withdrawals;
DROP POLICY IF EXISTS "Admin can manage affiliate withdrawals" ON affiliate_withdrawals;

-- Enable RLS
ALTER TABLE affiliate_withdrawals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own affiliate withdrawals" ON affiliate_withdrawals
  FOR SELECT USING (affiliate_id = auth.uid());

CREATE POLICY "Users can insert own affiliate withdrawals" ON affiliate_withdrawals
  FOR INSERT WITH CHECK (affiliate_id = auth.uid());

CREATE POLICY "Admin can manage affiliate withdrawals" ON affiliate_withdrawals
  FOR ALL USING (true);

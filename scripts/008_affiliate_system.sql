-- =============================================
-- AFFILIATE SYSTEM TABLES
-- =============================================

-- Add affiliate columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_affiliate BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS affiliate_code VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS affiliate_commission_percent DECIMAL(5,2) DEFAULT 70.00,
ADD COLUMN IF NOT EXISTS affiliate_status VARCHAR(20) DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS referred_by VARCHAR(20),
ADD COLUMN IF NOT EXISTS affiliate_balance DECIMAL(15,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS affiliate_total_earned DECIMAL(15,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS affiliate_total_referrals INTEGER DEFAULT 0;

-- Create affiliate_commissions table to track commissions
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

-- Create affiliate_withdrawals table
CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  pix_key VARCHAR(255),
  pix_key_type VARCHAR(20),
  admin_notes TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_affiliate_code ON profiles(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles(referred_by);
CREATE INDEX IF NOT EXISTS idx_profiles_is_affiliate ON profiles(is_affiliate);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_referred_user_id ON affiliate_commissions(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_affiliate_id ON affiliate_withdrawals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_status ON affiliate_withdrawals(status);

-- Enable RLS
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for affiliate_commissions
CREATE POLICY "Users can view own commissions" ON affiliate_commissions
  FOR SELECT USING (affiliate_id = auth.uid());

CREATE POLICY "Service role can manage commissions" ON affiliate_commissions
  FOR ALL USING (true);

-- RLS Policies for affiliate_withdrawals
CREATE POLICY "Users can view own affiliate withdrawals" ON affiliate_withdrawals
  FOR SELECT USING (affiliate_id = auth.uid());

CREATE POLICY "Users can insert own affiliate withdrawals" ON affiliate_withdrawals
  FOR INSERT WITH CHECK (affiliate_id = auth.uid());

CREATE POLICY "Service role can manage affiliate withdrawals" ON affiliate_withdrawals
  FOR ALL USING (true);

-- Function to generate unique affiliate code
CREATE OR REPLACE FUNCTION generate_affiliate_code()
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

-- Function to enable user as affiliate
CREATE OR REPLACE FUNCTION enable_affiliate(user_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
  new_code VARCHAR(20);
  code_exists BOOLEAN;
BEGIN
  -- Generate unique code
  LOOP
    new_code := generate_affiliate_code();
    SELECT EXISTS(SELECT 1 FROM profiles WHERE affiliate_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  -- Update profile
  UPDATE profiles 
  SET 
    is_affiliate = true,
    affiliate_code = new_code,
    affiliate_status = 'active'
  WHERE id = user_id;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate and add commission when deposit is approved
CREATE OR REPLACE FUNCTION process_affiliate_commission()
RETURNS TRIGGER AS $$
DECLARE
  referrer_code VARCHAR(20);
  referrer_id UUID;
  referrer_commission DECIMAL(5,2);
  commission_value DECIMAL(15,2);
BEGIN
  -- Only process when deposit status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get the referrer code from the depositor's profile
    SELECT referred_by INTO referrer_code
    FROM profiles
    WHERE id = NEW.user_id;
    
    -- If user was referred
    IF referrer_code IS NOT NULL THEN
      -- Get referrer info
      SELECT id, affiliate_commission_percent INTO referrer_id, referrer_commission
      FROM profiles
      WHERE affiliate_code = referrer_code
        AND is_affiliate = true
        AND affiliate_status = 'active';
      
      -- If referrer exists and is active
      IF referrer_id IS NOT NULL THEN
        -- Calculate commission
        commission_value := NEW.amount * (referrer_commission / 100);
        
        -- Insert commission record
        INSERT INTO affiliate_commissions (
          affiliate_id,
          referred_user_id,
          deposit_id,
          deposit_amount,
          commission_percent,
          commission_amount
        ) VALUES (
          referrer_id,
          NEW.user_id,
          NEW.id,
          NEW.amount,
          referrer_commission,
          commission_value
        ) ON CONFLICT (deposit_id) DO NOTHING;
        
        -- Update affiliate balance
        UPDATE profiles
        SET affiliate_balance = affiliate_balance + commission_value
        WHERE id = referrer_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for deposit commission
DROP TRIGGER IF EXISTS trigger_affiliate_commission ON deposits;
CREATE TRIGGER trigger_affiliate_commission
  AFTER INSERT OR UPDATE ON deposits
  FOR EACH ROW
  EXECUTE FUNCTION process_affiliate_commission();

-- =============================================
-- UPDATE AFFILIATE COMMISSION TO 70%
-- =============================================

-- Atualizar comissao padrao para 70%
ALTER TABLE profiles 
ALTER COLUMN affiliate_commission_percent SET DEFAULT 70.00;

-- Atualizar todos os afiliados existentes para 70%
UPDATE profiles 
SET affiliate_commission_percent = 70.00 
WHERE is_affiliate = true;

-- Atualizar a funcao de processar comissao para usar 70% como padrao
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
      SELECT id, COALESCE(affiliate_commission_percent, 70) INTO referrer_id, referrer_commission
      FROM profiles
      WHERE affiliate_code = referrer_code
        AND is_affiliate = true
        AND affiliate_status = 'active';
      
      -- If referrer exists and is active
      IF referrer_id IS NOT NULL THEN
        -- Calculate commission (70% default)
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
        
        -- Update affiliate balance and total earned
        UPDATE profiles
        SET 
          affiliate_balance = COALESCE(affiliate_balance, 0) + commission_value,
          affiliate_total_earned = COALESCE(affiliate_total_earned, 0) + commission_value
        WHERE id = referrer_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar trigger
DROP TRIGGER IF EXISTS trigger_affiliate_commission ON deposits;
CREATE TRIGGER trigger_affiliate_commission
  AFTER INSERT OR UPDATE ON deposits
  FOR EACH ROW
  EXECUTE FUNCTION process_affiliate_commission();

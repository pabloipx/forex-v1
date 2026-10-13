-- Garantir que a coluna reviewed_at existe na tabela kyc_requests
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kyc_requests' AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE kyc_requests ADD COLUMN reviewed_at TIMESTAMPTZ;
  END IF;
END $$;

-- Garantir que a coluna rejection_reason existe na tabela kyc_requests
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kyc_requests' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE kyc_requests ADD COLUMN rejection_reason TEXT;
  END IF;
END $$;

-- Garantir que a coluna kyc_status existe na tabela profiles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'kyc_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN kyc_status TEXT DEFAULT 'pending';
  END IF;
END $$;

-- Garantir que a coluna is_verified existe na tabela profiles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'is_verified'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_verified BOOLEAN DEFAULT false;
  END IF;
END $$;

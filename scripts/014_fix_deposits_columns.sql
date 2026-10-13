-- Add missing columns to deposits table
-- These columns may not exist if the table was created before 011_complete_setup.sql

DO $$
BEGIN
  -- Add payment_method if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deposits' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE deposits ADD COLUMN payment_method TEXT DEFAULT 'pix';
  END IF;

  -- Add currency if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deposits' AND column_name = 'currency'
  ) THEN
    ALTER TABLE deposits ADD COLUMN currency TEXT DEFAULT 'BRL';
  END IF;

  -- Add external_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deposits' AND column_name = 'external_id'
  ) THEN
    ALTER TABLE deposits ADD COLUMN external_id TEXT;
  END IF;

  -- Add qr_code if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deposits' AND column_name = 'qr_code'
  ) THEN
    ALTER TABLE deposits ADD COLUMN qr_code TEXT;
  END IF;

  -- Add copy_paste if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deposits' AND column_name = 'copy_paste'
  ) THEN
    ALTER TABLE deposits ADD COLUMN copy_paste TEXT;
  END IF;

  -- Add payment_reference if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deposits' AND column_name = 'payment_reference'
  ) THEN
    ALTER TABLE deposits ADD COLUMN payment_reference TEXT;
  END IF;

  -- Add completed_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deposits' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE deposits ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add UNIQUE constraints to allow UPSERT operations
-- This should be run once to fix the database schema

-- Add unique constraint on otc_symbols.symbol
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'otc_symbols_symbol_key'
  ) THEN
    ALTER TABLE public.otc_symbols ADD CONSTRAINT otc_symbols_symbol_key UNIQUE (symbol);
  END IF;
END $$;

-- Add unique constraint on platform_settings.setting_key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'platform_settings_setting_key_key'
  ) THEN
    ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_setting_key_key UNIQUE (setting_key);
  END IF;
END $$;

-- Add unique constraint on user_balances.user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_balances_user_id_key'
  ) THEN
    ALTER TABLE public.user_balances ADD CONSTRAINT user_balances_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Add unique constraint on profiles.email (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
  END IF;
END $$;

-- Drop the problematic trigger that causes "Database error querying schema"
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

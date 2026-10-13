-- Create test user directly in auth.users
-- Note: In production Supabase, users are created via auth API
-- This script is for development/testing purposes

-- Insert test user into profiles and balances
-- The user must first be created via Supabase Auth signup
-- After signup, this script updates the balance to $1000

-- Create a function to set up test user
CREATE OR REPLACE FUNCTION setup_test_user(user_email TEXT, user_id UUID)
RETURNS void AS $$
BEGIN
  -- Insert or update profile
  INSERT INTO public.profiles (id, email, display_name, created_at, updated_at)
  VALUES (user_id, user_email, 'Test User', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      updated_at = NOW();

  -- Insert or update balance with $1000
  INSERT INTO public.user_balances (user_id, balance, currency, created_at, updated_at)
  VALUES (user_id, 1000.00, 'USD', NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET balance = 1000.00,
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION setup_test_user(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION setup_test_user(TEXT, UUID) TO anon;

-- Instructions:
-- 1. User must sign up with email: teste@gmail.com and password: 12345
-- 2. After signup, get the user_id from auth.users table
-- 3. Run: SELECT setup_test_user('teste@gmail.com', '<user_id_here>');

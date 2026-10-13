-- ===============================================
-- FIX RLS POLICIES TO PREVENT INFINITE RECURSION
-- ===============================================

-- Drop existing problematic policies on profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Create simple policies that don't cause recursion
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Drop and recreate policies for user_balances
DROP POLICY IF EXISTS "Admins can view all balances" ON user_balances;
DROP POLICY IF EXISTS "Users can view their own balance" ON user_balances;
DROP POLICY IF EXISTS "Users can update their own balance" ON user_balances;
DROP POLICY IF EXISTS "Users can insert their own balance" ON user_balances;

-- Simple policies for user_balances
CREATE POLICY "Users can view own balance"
ON user_balances FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own balance"
ON user_balances FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own balance"
ON user_balances FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Drop and recreate policies for trades
DROP POLICY IF EXISTS "Admins can view all trades" ON trades;
DROP POLICY IF EXISTS "Users can view their own trades" ON trades;
DROP POLICY IF EXISTS "Users can insert their own trades" ON trades;
DROP POLICY IF EXISTS "Users can update their own pending trades" ON trades;

-- Simple policies for trades
CREATE POLICY "Users can view own trades"
ON trades FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades"
ON trades FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades"
ON trades FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Drop and recreate policies for transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;

CREATE POLICY "Users can view own transactions"
ON transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
ON transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Drop and recreate policies for deposits
DROP POLICY IF EXISTS "Users can view their own deposits" ON deposits;
DROP POLICY IF EXISTS "Users can create deposits" ON deposits;

CREATE POLICY "Users can view own deposits"
ON deposits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own deposits"
ON deposits FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Drop and recreate policies for withdrawals
DROP POLICY IF EXISTS "Users can view their own withdrawals" ON withdrawals;
DROP POLICY IF EXISTS "Users can create withdrawals" ON withdrawals;

CREATE POLICY "Users can view own withdrawals"
ON withdrawals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own withdrawals"
ON withdrawals FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Drop and recreate policies for bonuses
DROP POLICY IF EXISTS "Users can view their own bonuses" ON bonuses;

CREATE POLICY "Users can view own bonuses"
ON bonuses FOR SELECT
USING (auth.uid() = user_id);

-- Drop and recreate policies for otc_symbols (public read)
DROP POLICY IF EXISTS "Anyone can view active symbols" ON otc_symbols;
DROP POLICY IF EXISTS "Admins can manage OTC symbols" ON otc_symbols;

CREATE POLICY "Anyone can view symbols"
ON otc_symbols FOR SELECT
USING (true);

-- Drop and recreate policies for platform_settings
DROP POLICY IF EXISTS "Anyone can view public settings" ON platform_settings;
DROP POLICY IF EXISTS "Admins can manage platform settings" ON platform_settings;

CREATE POLICY "Anyone can view settings"
ON platform_settings FOR SELECT
USING (true);

-- 013: Optimize trades table with indexes and normalize result casing
-- This script adds performance indexes and normalizes inconsistent result values

-- 1. Normalize all result values to lowercase
-- Some code paths wrote PENDING/WIN/LOSS, others wrote pending/win/loss
UPDATE trades SET result = LOWER(result) WHERE result <> LOWER(result);

-- 2. Partial index for finding pending trades by user (most common query)
CREATE INDEX IF NOT EXISTS idx_trades_user_pending
  ON trades (user_id, symbol, is_demo, created_at DESC)
  WHERE result = 'pending';

-- 3. Partial index for finding expired pending trades (finalizeExpiredTrades)
CREATE INDEX IF NOT EXISTS idx_trades_expiry_pending
  ON trades (expiry_time)
  WHERE result = 'pending';

-- 4. Composite index for user trade history (ordered by created_at)
CREATE INDEX IF NOT EXISTS idx_trades_user_created
  ON trades (user_id, created_at DESC);

-- 5. Index on deposits for user + status lookups
CREATE INDEX IF NOT EXISTS idx_deposits_user_status
  ON deposits (user_id, status);

-- 6. Index on withdrawals for user + status lookups  
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status
  ON withdrawals (user_id, status);

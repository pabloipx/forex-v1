-- Create trade_history_log for auditing trade edits
CREATE TABLE IF NOT EXISTS trade_history_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL,
  user_id UUID NOT NULL,
  admin_id TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  old_value DECIMAL(15,2),
  new_value DECIMAL(15,2),
  old_profit DECIMAL(15,2),
  new_profit DECIMAL(15,2),
  old_direction TEXT,
  new_direction TEXT,
  old_timeframe INTEGER,
  new_timeframe INTEGER,
  old_created_at TIMESTAMP WITH TIME ZONE,
  new_created_at TIMESTAMP WITH TIME ZONE,
  balance_before DECIMAL(15,2),
  balance_after DECIMAL(15,2),
  balance_adjustment DECIMAL(15,2),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to trades for manual adjustment tracking
ALTER TABLE trades ADD COLUMN IF NOT EXISTS is_manually_adjusted BOOLEAN DEFAULT false;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS adjusted_by TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS adjusted_at TIMESTAMP WITH TIME ZONE;

-- Disable RLS on trade_history_log (admin/service role only)
ALTER TABLE trade_history_log ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on trade_history_log"
  ON trade_history_log FOR ALL
  USING (true)
  WITH CHECK (true);

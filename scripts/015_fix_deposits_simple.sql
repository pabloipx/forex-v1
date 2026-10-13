-- Add missing columns to deposits table (simple ALTER statements)
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'pix';
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL';
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS copy_paste TEXT;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

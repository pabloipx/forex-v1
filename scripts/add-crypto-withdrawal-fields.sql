-- Add crypto withdrawal fields to withdrawals table
ALTER TABLE withdrawals 
ADD COLUMN IF NOT EXISTS crypto_type TEXT,
ADD COLUMN IF NOT EXISTS crypto_wallet TEXT;

-- Update method check constraint to allow 'crypto' as a valid method
ALTER TABLE withdrawals 
DROP CONSTRAINT IF EXISTS withdrawals_method_check;

ALTER TABLE withdrawals 
ADD CONSTRAINT withdrawals_method_check 
CHECK (method IN ('pix', 'crypto', 'bank_transfer'));

-- Script para garantir que o admin tenha acesso total
-- Execute este script no SQL Editor do Supabase

-- 1. Definir o usuário como admin (substitua o email pelo seu)
UPDATE profiles 
SET is_admin = true 
WHERE email = 'pabloandrade1790@gmail.com';

-- 2. Verificar se o usuário foi marcado como admin
SELECT id, email, full_name, is_admin, created_at 
FROM profiles 
WHERE email = 'pabloandrade1790@gmail.com';

-- 3. Verificar quantos usuários existem
SELECT COUNT(*) as total_users FROM profiles;

-- 4. Verificar quantos depósitos existem
SELECT COUNT(*) as total_deposits, 
       SUM(amount) as total_amount,
       status
FROM deposits 
GROUP BY status;

-- 5. Verificar quantos trades existem
SELECT COUNT(*) as total_trades, 
       is_demo,
       result
FROM trades 
GROUP BY is_demo, result;

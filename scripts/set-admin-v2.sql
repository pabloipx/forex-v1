-- Script para definir um usuário como administrador
-- Substitua o email pelo email do usuário que você quer tornar admin

-- Opção 1: Por email
UPDATE profiles 
SET is_admin = true 
WHERE email = 'pabloandrade1790@gmail.com';

-- Verificar se o update funcionou
SELECT id, email, full_name, is_admin 
FROM profiles 
WHERE is_admin = true;

-- Listar todos os usuários para debug
SELECT id, email, full_name, is_admin, created_at 
FROM profiles 
ORDER BY created_at DESC;

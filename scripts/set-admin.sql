-- Script para definir um usuário como administrador
-- Substitua 'seu-email@exemplo.com' pelo email do usuário que deve ser admin

-- Opção 1: Definir admin pelo email
UPDATE profiles 
SET is_admin = true 
WHERE email = 'pabloandrade1790@gmail.com';

-- Opção 2: Se você quiser definir um email específico como admin, descomente e altere:
-- UPDATE profiles 
-- SET is_admin = true 
-- WHERE email = 'seu-email@exemplo.com';

-- Verificar se foi atualizado
SELECT id, email, full_name, is_admin FROM profiles WHERE is_admin = true;

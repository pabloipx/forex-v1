-- Adicionar permissões admin para visualizar todos os usuários
-- Remove políticas RLS restritivas para admins
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all balances" ON user_balances;

-- Permite que qualquer usuário autenticado leia perfis (necessário para admin)
CREATE POLICY "Authenticated users can view profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Permite que qualquer usuário autenticado leia saldos (necessário para admin)
CREATE POLICY "Authenticated users can view balances"
ON user_balances FOR SELECT
TO authenticated
USING (true);

-- Permite admins atualizarem qualquer perfil
CREATE POLICY "Admins can update any profile"
ON profiles FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Permite admins atualizarem qualquer saldo
CREATE POLICY "Admins can update any balance"
ON user_balances FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

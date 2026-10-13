-- Adiciona constraints UNIQUE que estão faltando para os upserts funcionarem

-- Adiciona UNIQUE na coluna symbol de otc_symbols
ALTER TABLE public.otc_symbols 
ADD CONSTRAINT otc_symbols_symbol_unique UNIQUE (symbol);

-- Adiciona UNIQUE na coluna setting_key de platform_settings
ALTER TABLE public.platform_settings 
ADD CONSTRAINT platform_settings_setting_key_unique UNIQUE (setting_key);

-- Adiciona UNIQUE na coluna user_id de user_balances
ALTER TABLE public.user_balances 
ADD CONSTRAINT user_balances_user_id_unique UNIQUE (user_id);

-- Adiciona UNIQUE na coluna email de profiles (caso não exista)
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_email_unique UNIQUE (email);

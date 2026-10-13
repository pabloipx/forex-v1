// Fonte única das variáveis de ambiente do Supabase.
//
// Nomes definidos no projeto Vercel (não renomear):
//   NEXT_PUBLIC_SUPABASE_URL              -> URL do projeto (cliente e servidor)
//   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  -> chave pública, segura para o navegador
//   SUPABASE_SECRET_KEY                   -> chave secreta, SOMENTE no servidor
//
// As referências abaixo precisam ser literais (`process.env.NEXT_PUBLIC_*`) para
// que o Next.js consiga inlinar os valores públicos no bundle do navegador.

export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || ""
}

export function getSupabasePublishableKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
}

/**
 * Chave secreta do Supabase (ignora RLS). Nunca importar em código que roda no
 * navegador: em componentes de cliente `process.env.SUPABASE_SECRET_KEY` é
 * sempre undefined e a função lança para evitar uso acidental.
 */
export function getSupabaseSecretKey(): string {
  if (typeof window !== "undefined") {
    throw new Error("SUPABASE_SECRET_KEY não pode ser usada no navegador")
  }
  return process.env.SUPABASE_SECRET_KEY || ""
}

export function isSupabaseAdminConfigured(): boolean {
  return typeof window === "undefined" && !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
}

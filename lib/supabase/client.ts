import { createBrowserClient } from "@supabase/ssr"
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured } from "./env"

let clientInstance: ReturnType<typeof createBrowserClient> | null = null

// Cliente do navegador: usa apenas NEXT_PUBLIC_SUPABASE_URL e
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Nunca a chave secreta.
export function createClient() {
  if (clientInstance) return clientInstance

  // Sem as variáveis (ex.: build/prerender na Vercel antes de configurar o
  // Supabase) o createBrowserClient lança erro e derruba o build. Usamos valores
  // inertes: as chamadas apenas falham em tempo de execução e as telas tratam o erro.
  clientInstance = createBrowserClient(
    getSupabaseUrl() || "https://not-configured.supabase.co",
    getSupabasePublishableKey() || "not-configured",
  )
  return clientInstance
}

export { isSupabaseConfigured }

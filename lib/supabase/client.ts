import { createBrowserClient } from "@supabase/ssr"
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured } from "./env"

let clientInstance: ReturnType<typeof createBrowserClient> | null = null

// Cliente do navegador: usa apenas NEXT_PUBLIC_SUPABASE_URL e
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Nunca a chave secreta.
export function createClient() {
  if (clientInstance) return clientInstance

  clientInstance = createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey())
  return clientInstance
}

export { isSupabaseConfigured }

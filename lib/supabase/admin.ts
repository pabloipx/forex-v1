import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseSecretKey, getSupabaseUrl } from "./env"

let adminClient: SupabaseClient | null = null

// Admin client with SUPABASE_SECRET_KEY - use only on server side
export function createAdminClient(): SupabaseClient {
  const supabaseUrl = getSupabaseUrl()
  const supabaseSecretKey = getSupabaseSecretKey()

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Missing SUPABASE_SECRET_KEY or NEXT_PUBLIC_SUPABASE_URL")
  }

  // Only cache if we have valid credentials
  if (adminClient) return adminClient

  adminClient = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return adminClient
}

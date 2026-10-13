import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY

if (!url || !key) {
  console.error("[v0] Missing Supabase env vars")
  process.exit(1)
}

const email = process.argv[2]
if (!email) {
  console.error("[v0] Usage: node remove-rollover.mjs <email>")
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

// 1) Localiza o usuario pelo e-mail na tabela profiles.
const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("id, email")
  .ilike("email", email)
  .maybeSingle()

if (profileError) {
  console.error("[v0] Erro ao buscar perfil:", profileError.message)
  process.exit(1)
}
if (!profile) {
  console.error("[v0] Usuario nao encontrado para o e-mail:", email)
  process.exit(1)
}

console.log("[v0] Usuario encontrado:", profile.id, profile.email)

// 2) Mostra as travas de rollover atuais desse usuario.
const { data: before } = await supabase
  .from("deposit_rollovers")
  .select("id, rollover_required, rollover_progress")
  .eq("user_id", profile.id)

console.log("[v0] Travas de rollover encontradas:", before?.length || 0)

// 3) Remove todas as travas de rollover do usuario.
const { data: deleted, error: deleteError } = await supabase
  .from("deposit_rollovers")
  .delete()
  .eq("user_id", profile.id)
  .select("id")

if (deleteError) {
  console.error("[v0] Erro ao remover rollover:", deleteError.message)
  process.exit(1)
}

console.log("[v0] Travas de rollover removidas:", deleted?.length || 0)
console.log("[v0] Concluido.")

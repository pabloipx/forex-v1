import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
const admin = createClient(url, key, { auth: { persistSession: false } })

const email = "teste-ia@example.com"
const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
const u = list.users.find((x) => x.email === email)
if (!u) {
  console.log("nada a limpar")
  process.exit(0)
}
await admin.from("trades").delete().eq("user_id", u.id)
await admin.from("user_balances").delete().eq("user_id", u.id)
await admin.from("platform_settings").delete().eq("key", `ia_broker_state:${u.id}`)
await admin.auth.admin.deleteUser(u.id)
console.log("usuário de teste removido:", email)

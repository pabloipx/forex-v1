import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
const admin = createClient(url, key)

const { data: profiles } = await admin
  .from("profiles")
  .select("id, email, full_name")
  .or("email.ilike.%calochi%,email.ilike.%calochinho%")

console.log("PROFILES:", JSON.stringify(profiles, null, 2))

for (const p of profiles || []) {
  const { data: bal } = await admin
    .from("user_balances")
    .select("*")
    .eq("user_id", p.id)
    .maybeSingle()
  console.log(`\nBALANCE ${p.email}:`, JSON.stringify(bal, null, 2))

  const { data: st } = await admin
    .from("platform_settings")
    .select("setting_value")
    .eq("setting_key", `ia_broker_state:${p.id}`)
    .maybeSingle()
  console.log(`IA STATE ${p.email}:`, st?.setting_value)

  const { data: trades, error: tErr } = await admin
    .from("trades")
    .select("*")
    .eq("user_id", p.id)
    .order("created_at", { ascending: false })
    .limit(8)
  console.log(`TRADES ERROR ${p.email}:`, tErr?.message || "none")
  console.log(`RECENT TRADES ${p.email}:`, JSON.stringify(trades, null, 2))
}

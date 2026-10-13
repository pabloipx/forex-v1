import { createClient } from "@supabase/supabase-js"

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY)

for (const [from, to] of [["WIN", "win"], ["LOSS", "loss"]]) {
  const { data, error } = await admin
    .from("trades")
    .update({ result: to })
    .eq("result", from)
    .select("id")
  console.log(`${from} -> ${to}:`, error ? `ERROR ${error.message}` : `${data?.length || 0} linhas`)
}

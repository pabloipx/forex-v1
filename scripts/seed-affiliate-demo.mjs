/**
 * Cria dados de EXEMPLO para visualizar o painel de afiliados.
 *
 * Todos os registros usam e-mails com o sufixo `@demo.kobilex.local`, que serve de marcador
 * para a remocao. Nenhum dado real e tocado.
 *
 * Uso:
 *   node --env-file-if-exists=/vercel/share/.env.project scripts/seed-affiliate-demo.mjs
 *   node --env-file-if-exists=/vercel/share/.env.project scripts/seed-affiliate-demo.mjs --limpar
 */
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY

if (!url || !key) {
  console.error("Faltam SUPABASE_URL / SUPABASE_SECRET_KEY no ambiente.")
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })

const MARCADOR = "@demo.kobilex.local"
const SENHA_DEMO = "DemoKobilex#2026"
const AFFILIATE_CODE = "DEMOAFF"

const money = (v) => Math.round(v * 100) / 100

/** Remove todos os dados de exemplo criados por este script. */
async function limpar() {
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 })
  const demoUsers = (users?.users ?? []).filter((u) => u.email?.endsWith(MARCADOR))

  if (demoUsers.length === 0) {
    console.log("Nenhum dado de exemplo encontrado.")
    return
  }

  const ids = demoUsers.map((u) => u.id)

  // Ordem importa: filhos antes dos pais.
  await db.from("affiliate_commissions").delete().in("affiliate_id", ids)
  await db.from("affiliate_commissions").delete().in("referred_user_id", ids)
  await db.from("affiliate_withdrawals").delete().in("affiliate_id", ids)
  await db.from("affiliate_admin_logs").delete().in("affiliate_id", ids)
  await db.from("trades").delete().in("user_id", ids)
  await db.from("deposits").delete().in("user_id", ids)
  await db.from("transactions").delete().in("user_id", ids)
  await db.from("profiles").delete().in("id", ids)

  for (const u of demoUsers) {
    await db.auth.admin.deleteUser(u.id)
  }

  console.log(`Removidos ${demoUsers.length} usuarios de exemplo e seus registros.`)
}

async function criarUsuario(email, nome) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: SENHA_DEMO,
    email_confirm: true,
    user_metadata: { full_name: nome },
  })
  if (error) throw new Error(`Falha ao criar ${email}: ${error.message}`)
  return data.user.id
}

async function semear() {
  console.log("Criando dados de exemplo...\n")

  // 1. O afiliado
  const afiliadoId = await criarUsuario(`ana.afiliada${MARCADOR}`, "Ana Afiliada (exemplo)")
  await db
    .from("profiles")
    .update({
      full_name: "Ana Afiliada (exemplo)",
      is_affiliate: true,
      affiliate_status: "active",
      affiliate_code: AFFILIATE_CODE,
      affiliate_commission_model: "hybrid",
      affiliate_commission_percent: 40,
      affiliate_cpa_amount: 120,
      affiliate_cpa_min_deposit: 100,
      affiliate_balance: 0,
      affiliate_total_earned: 0,
    })
    .eq("id", afiliadoId)
  console.log(`Afiliado criado: Ana Afiliada  (codigo ${AFFILIATE_CODE})`)

  // 2. Indicados. `perdaLiquida` = quanto a casa lucrou com as operacoes dele.
  const indicados = [
    { nome: "Bruno Silva", email: `bruno${MARCADOR}`, deposito: 500, perdaLiquida: 320 },
    { nome: "Carla Souza", email: `carla${MARCADOR}`, deposito: 250, perdaLiquida: 180 },
    { nome: "Diego Lima", email: `diego${MARCADOR}`, deposito: 1000, perdaLiquida: -150 },
    { nome: "Elena Costa", email: `elena${MARCADOR}`, deposito: 80, perdaLiquida: 60 },
    { nome: "Felipe Rocha", email: `felipe${MARCADOR}`, deposito: 0, perdaLiquida: 0 },
  ]

  for (const ind of indicados) {
    const userId = await criarUsuario(ind.email, ind.nome)

    await db
      .from("profiles")
      .update({ full_name: ind.nome, referred_by: AFFILIATE_CODE, balance: 0 })
      .eq("id", userId)

    if (ind.deposito > 0) {
      // Deposito ja aprovado. Inserimos direto para nao depender do gateway.
      const { data: dep } = await db
        .from("deposits")
        .insert({
          user_id: userId,
          amount: ind.deposito,
          status: "approved",
          method: "pix",
        })
        .select("id")
        .single()

      await db.from("profiles").update({ balance: ind.deposito }).eq("id", userId)

      // CPA: uma vez por indicado, se o deposito atingir o minimo (100).
      if (ind.deposito >= 100) {
        await db.from("affiliate_commissions").insert({
          affiliate_id: afiliadoId,
          referred_user_id: userId,
          reference_id: dep?.id ?? null,
          type: "cpa",
          status: "approved",
          base_amount: ind.deposito,
          deposit_amount: ind.deposito,
          percent: 0,
          amount: 120,
          revshare_amount: 0,
          cpa_amount: 120,
          level: 1,
          description: "CPA do primeiro deposito de indicado",
        })
      }
    }

    // Operacoes encerradas. `profit` e do ponto de vista do JOGADOR, entao a receita da casa
    // e o negativo disso. Criamos duas operacoes cujo resultado somado da a perda liquida.
    if (ind.perdaLiquida !== 0) {
      const perdaJogador = ind.perdaLiquida
      const aposta = Math.max(Math.abs(perdaJogador), 20)

      await db.from("trades").insert([
        {
          user_id: userId,
          symbol: "EURUSD",
          direction: "CALL",
          amount: aposta,
          entry_price: 1.085,
          exit_price: 1.084,
          timeframe: 60,
          payout_percentage: 96,
          result: perdaJogador > 0 ? "loss" : "win",
          profit: perdaJogador > 0 ? -perdaJogador : Math.abs(perdaJogador),
          is_demo: false,
          entry_time: new Date(Date.now() - 3600_000).toISOString(),
          closed_at: new Date(Date.now() - 3540_000).toISOString(),
          status: "closed",
        },
      ])
    }

    console.log(
      `  Indicado: ${ind.nome.padEnd(14)} deposito R$ ${String(ind.deposito).padStart(5)}  receita da casa R$ ${ind.perdaLiquida}`,
    )
  }

  // 3. Soma o CPA ao saldo do afiliado. Em producao isso acontece dentro de approveDeposit;
  // aqui os depositos foram inseridos direto, entao replicamos o efeito no saldo.
  const { data: cpaRows } = await db
    .from("affiliate_commissions")
    .select("cpa_amount")
    .eq("affiliate_id", afiliadoId)
    .eq("type", "cpa")

  const cpaTotal = money((cpaRows ?? []).reduce((acc, r) => acc + Number(r.cpa_amount || 0), 0))
  if (cpaTotal > 0) {
    await db
      .from("profiles")
      .update({ affiliate_balance: cpaTotal, affiliate_total_earned: cpaTotal })
      .eq("id", afiliadoId)
    console.log(`\nCPA somado ao saldo do afiliado: R$ ${cpaTotal}`)
  }

  // 4. Um saque pendente, para o admin ter algo para processar.
  await db.from("affiliate_withdrawals").insert({
    affiliate_id: afiliadoId,
    amount: 150,
    fee: 3,
    net_amount: 147,
    status: "pending",
    method: "pix",
  })

  console.log("\nSaque pendente de R$ 150 criado.")
  console.log("\nPronto. Abra /admin/dashboard na aba Afiliados.")
  console.log("O RevShare das operacoes e apurado automaticamente ao abrir o painel.")
  console.log(`\nPara remover tudo: node --env-file-if-exists=/vercel/share/.env.project scripts/seed-affiliate-demo.mjs --limpar`)
}

const main = process.argv.includes("--limpar") ? limpar : semear
main().catch((e) => {
  console.error("Erro:", e.message)
  process.exit(1)
})

import { createAdminClient } from "@/lib/supabase/admin"
import type { RealCandle } from "./real-price-store"

// Construcao das velas de 1 MINUTO a partir dos ticks reais de mercado.
//
// Por que isso existe: nenhuma fonte gratuita entrega OHLC real de 1m para forex. O Yahoo
// devolve open=high=low=close em todos os minutos (vela sem corpo, grafico achatado) e o
// TradingView so expoe o preco atual, sem historico. Entao a plataforma faz o que uma
// corretora faz: recebe o fluxo de precos reais e monta as velas a partir dele.
//
// Todo valor gravado aqui e um preco real de mercado — nada e sintetizado.

const BUCKET = 60 // 1 minuto, em segundos

/** Inicio do minuto a que um instante pertence (em epoch/segundos) */
function bucketOf(tsMs: number): number {
  return Math.floor(tsMs / 1000 / BUCKET) * BUCKET
}

// Throttle por simbolo. Sem ele, cada usuario conectado geraria uma gravacao por tick e 100
// usuarios produziriam dezenas de escritas por segundo no mesmo simbolo, todas com o mesmo
// preco. O limite e por SIMBOLO, nao por usuario: a vela e compartilhada, entao um unico
// registro por instante serve a todos.
//
// 1s casa com o cache de preco da rota (o valor upstream nao muda mais rapido que isso) e da
// ~60 amostras por vela de 1m — resolucao suficiente para o high/low do minuto.
const MIN_WRITE_INTERVAL_MS = 1000
const lastWrite = new Map<string, number>()

// Retencao: o grafico usa no maximo algumas horas de 1m, mas guardamos alguns dias para
// cobrir fim de semana e reinicios. Sem isso a tabela cresceria ~17 mil linhas por dia.
const RETENTION_DAYS = 7
const PRUNE_INTERVAL_MS = 60 * 60 * 1000 // no maximo uma limpeza por hora
let lastPrune = 0

/** Remove velas antigas. Roda no maximo uma vez por hora e nunca bloqueia a resposta. */
function maybePrune(): void {
  const now = Date.now()
  if (now - lastPrune < PRUNE_INTERVAL_MS) return
  lastPrune = now

  const cutoff = Math.floor(now / 1000) - RETENTION_DAYS * 86400
  void createAdminClient()
    .from("market_candles_1m")
    .delete()
    .lt("bucket_time", cutoff)
    .then(({ error }) => {
      if (error) console.log("[v0] limpeza de velas falhou:", error.message)
    })
}

/**
 * Registra um preco real na vela do minuto corrente. Nao lanca excecao e nao deve ser
 * aguardado no caminho da resposta: a cotacao do usuario nunca pode ficar mais lenta (ou
 * falhar) por causa da gravacao do historico.
 */
export function recordTick(symbol: string, price: number): void {
  if (!Number.isFinite(price) || price <= 0) return

  const now = Date.now()
  const last = lastWrite.get(symbol) ?? 0
  if (now - last < MIN_WRITE_INTERVAL_MS) return
  lastWrite.set(symbol, now)

  const bucket = bucketOf(now)
  maybePrune()

  // A funcao record_market_tick faz um upsert atomico (greatest/least no proprio SQL),
  // entao gravacoes simultaneas de instancias diferentes nao perdem o high/low.
  void createAdminClient()
    .rpc("record_market_tick", { p_symbol: symbol, p_bucket: bucket, p_price: price })
    .then(({ error }) => {
      if (error) console.log("[v0] recordTick falhou:", symbol, error.message)
    })
}

/**
 * Ultimo preco real conhecido de cada simbolo, lido do historico de ticks gravado.
 *
 * Existe porque o feed de precos roda no NAVEGADOR: no servidor o real-price-store esta
 * sempre vazio, e ate agora as rotas de servidor caiam no gerador sintetico para os ativos de
 * mercado aberto (numeros diferentes dos do grafico). Lendo do historico gravado, o servidor
 * responde com o mesmo preco real que todos os usuarios estao vendo.
 *
 * Retorna tambem o primeiro fechamento da janela, para a variacao percentual sair de dado
 * real em vez do basePrice de catalogo.
 */
export async function getRecordedSnapshots(
  symbols: string[],
  windowMinutes = 240,
): Promise<Map<string, { price: number; first: number }>> {
  const out = new Map<string, { price: number; first: number }>()
  if (!symbols.length) return out

  const since = Math.floor(Date.now() / 1000) - windowMinutes * BUCKET
  const { data, error } = await createAdminClient()
    .from("market_candles_1m")
    .select("symbol, bucket_time, close")
    .in("symbol", symbols)
    .gte("bucket_time", since)
    .order("bucket_time", { ascending: true })

  if (error) {
    console.log("[v0] getRecordedSnapshots falhou:", error.message)
    return out
  }

  // Ordem crescente: a primeira linha de cada simbolo e a mais antiga da janela e a ultima
  // sobrescreve o preco, ficando com a mais recente.
  for (const row of data ?? []) {
    const close = Number(row.close)
    if (!Number.isFinite(close) || close <= 0) continue
    const prev = out.get(row.symbol as string)
    if (prev) prev.price = close
    else out.set(row.symbol as string, { price: close, first: close })
  }

  return out
}

/**
 * Le as velas de 1m acumuladas para um simbolo. Retorna vazio quando ainda nao ha
 * historico suficiente, para que quem chama possa recorrer a outra fonte.
 */
export async function getRecordedCandles(symbol: string, limit = 240): Promise<RealCandle[]> {
  const { data, error } = await createAdminClient()
    .from("market_candles_1m")
    .select("bucket_time, open, high, low, close")
    .eq("symbol", symbol)
    .order("bucket_time", { ascending: false })
    .limit(limit)

  if (error) {
    console.log("[v0] getRecordedCandles falhou:", symbol, error.message)
    return []
  }

  // Vem em ordem decrescente (para pegar as mais recentes) e o grafico espera crescente
  return (data ?? [])
    .map(r => ({
      time: Number(r.bucket_time),
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
    }))
    .reverse()
}

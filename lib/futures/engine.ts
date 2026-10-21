import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { isSupabaseAdminConfigured } from "@/lib/supabase/env"
import { getAllTickers, getExecutionTicker, type Ticker } from "./prices"
import { getMarket, quoteToUsd, roundToStep, tpSlError, type FuturesMarket } from "./markets"
import type { Fill, Order, PlaceOrderInput, Position } from "./types"

import { TradingError } from "./errors"
import * as testEngine from "./demo-engine"
import { TEST_USER_ID } from "./demo-session"
import { ensureMarketSettings, paramsFor, withSpread } from "./market-settings"
import { getDerivatives, lastFundingTime, markPrice } from "./derivatives"

export { TradingError }

const isTestUser = (userId?: string) => userId === TEST_USER_ID

const num = (v: unknown): number | null => (v == null ? null : Number(v))

function normalizePosition(row: Record<string, unknown>): Position {
  return {
    ...(row as unknown as Position),
    qty: Number(row.qty),
    entry_price: Number(row.entry_price),
    margin: Number(row.margin),
    contract_size: Number(row.contract_size),
    liquidation_price: num(row.liquidation_price),
    take_profit: num(row.take_profit),
    stop_loss: num(row.stop_loss),
    trailing_distance: num(row.trailing_distance),
    trailing_peak: num(row.trailing_peak),
    funding_paid: Number(row.funding_paid ?? 0),
    realized_pnl: Number(row.realized_pnl),
    fees_paid: Number(row.fees_paid),
    exit_price: num(row.exit_price),
  }
}

function normalizeOrder(row: Record<string, unknown>): Order {
  return {
    ...(row as unknown as Order),
    price: num(row.price),
    trigger_price: num(row.trigger_price),
    qty: Number(row.qty),
    take_profit: num(row.take_profit),
    stop_loss: num(row.stop_loss),
    reserved_margin: Number(row.reserved_margin),
    filled_price: num(row.filled_price),
    filled_qty: Number(row.filled_qty),
    fee: Number(row.fee),
  }
}

function normalizeFill(row: Record<string, unknown>): Fill {
  return {
    ...(row as unknown as Fill),
    price: Number(row.price),
    qty: Number(row.qty),
    fee: Number(row.fee),
    realized_pnl: Number(row.realized_pnl),
  }
}

/** Converte erros do Postgres (raise exception) em mensagens legiveis. */
function rpcError(error: { message?: string } | null): TradingError {
  const msg = error?.message ?? "Erro ao executar ordem"
  if (msg.includes("Could not find the function") || msg.includes("does not exist")) {
    return new TradingError(
      "Banco de dados sem as tabelas de futuros. Rode scripts/200_futures_trading.sql no Supabase.",
      503,
    )
  }
  return new TradingError(msg)
}

interface FillArgs {
  userId: string
  isDemo: boolean
  market: FuturesMarket
  side: "buy" | "sell"
  qty: number
  price: number
  leverage: number
  marginMode: string
  feeRate: number
  reduceOnly?: boolean
  takeProfit?: number | null
  stopLoss?: number | null
  orderId?: string | null
  execType?: string
  isMaker?: boolean
}

async function rpcFill(admin: SupabaseClient, a: FillArgs) {
  const { data, error } = await admin.rpc("futures_fill", {
    p_user: a.userId,
    p_is_demo: a.isDemo,
    p_symbol: a.market.symbol,
    p_side: a.side,
    p_qty: a.qty,
    p_price: a.price,
    p_leverage: a.leverage,
    p_margin_mode: a.marginMode,
    p_contract_size: a.market.contractSize,
    p_quote_usd: quoteToUsd(a.market, a.price),
    p_fee_rate: a.feeRate,
    p_reduce_only: a.reduceOnly ?? false,
    p_take_profit: a.takeProfit ?? null,
    p_stop_loss: a.stopLoss ?? null,
    p_order_id: a.orderId ?? null,
    p_exec_type: a.execType ?? "trade",
    p_is_maker: a.isMaker ?? false,
  })
  if (error) throw rpcError(error)
  return data as { position_id: string; balance: number; realized_pnl: number; fee: number }
}

async function getOpenPosition(admin: SupabaseClient, userId: string, symbol: string, isDemo: boolean) {
  const { data } = await admin
    .from("futures_positions")
    .select("*")
    .eq("user_id", userId)
    .eq("symbol", symbol)
    .eq("is_demo", isDemo)
    .eq("status", "open")
    .maybeSingle()
  return data ? normalizePosition(data) : null
}

function validateTpSl(
  side: "buy" | "sell",
  ref: number,
  tp: number | null | undefined,
  sl: number | null | undefined,
  decimals: number,
  refLabel?: string,
) {
  const message = tpSlError(side, ref, tp, sl, decimals, refLabel)
  if (message) throw new TradingError(message)
}

export async function placeOrder(userId: string, input: PlaceOrderInput) {
  if (isTestUser(userId)) return testEngine.placeOrder(input)
  const market = getMarket(input.symbol)
  if (!market) throw new TradingError("Mercado inválido")

  const qty = roundToStep(input.qty, market.qtyStep)
  if (qty < market.minQty) throw new TradingError(`Quantidade mínima: ${market.minQty} ${market.qtyUnit}`)
  if (qty > market.maxQty) throw new TradingError(`Quantidade máxima: ${market.maxQty} ${market.qtyUnit}`)

  const isDemo = input.account === "demo"
  const admin = createAdminClient()
  await ensureMarketSettings()
  const params = paramsFor(market.symbol)
  if (!params.enabled && !input.reduceOnly) throw new TradingError("Mercado suspenso para novas posições")
  const raw = await getExecutionTicker(market.symbol)
  if (!raw) throw new TradingError("Cotação indisponível no momento. Tente novamente.", 503)
  const ticker = withSpread(raw, params.spreadBps)

  // A alavancagem e definida por simbolo: ao aumentar uma posicao usa a dela.
  const existing = await getOpenPosition(admin, userId, market.symbol, isDemo)
  const leverage = Math.min(
    Math.max(1, Math.floor(existing && !input.reduceOnly ? existing.leverage : input.leverage)),
    params.maxLeverage,
  )
  const marginMode = existing ? existing.margin_mode : input.marginMode

  if (input.reduceOnly) {
    const opposite = existing && (existing.side === "long" ? "sell" : "buy") === input.side
    if (!opposite) throw new TradingError("Reduce-only exige uma posição aberta no lado oposto")
  }

  const execPrice = input.side === "buy" ? ticker.ask || ticker.price : ticker.bid || ticker.price

  if (input.orderType === "market") {
    validateTpSl(input.side, execPrice, input.takeProfit, input.stopLoss, market.priceDecimals)
    const qtyToFill = input.reduceOnly && existing ? Math.min(qty, existing.qty) : qty
    return rpcFill(admin, {
      userId,
      isDemo,
      market,
      side: input.side,
      qty: qtyToFill,
      price: execPrice,
      leverage,
      marginMode,
      feeRate: paramsFor(market.symbol).takerFee,
      reduceOnly: input.reduceOnly,
      takeProfit: input.takeProfit,
      stopLoss: input.stopLoss,
    })
  }

  if (input.orderType === "limit") {
    const price = Number(input.price)
    if (!Number.isFinite(price) || price <= 0) throw new TradingError("Informe um preço válido")
    validateTpSl(input.side, price, input.takeProfit, input.stopLoss, market.priceDecimals)

    const marketable = input.side === "buy" ? price >= execPrice : price <= execPrice
    const tif = input.postOnly ? "PostOnly" : input.timeInForce ?? "GTC"

    if (marketable) {
      if (tif === "PostOnly") throw new TradingError("Ordem Post-Only seria executada imediatamente e foi cancelada")
      return rpcFill(admin, {
        userId,
        isDemo,
        market,
        side: input.side,
        qty: input.reduceOnly && existing ? Math.min(qty, existing.qty) : qty,
        price: execPrice,
        leverage,
        marginMode,
        feeRate: paramsFor(market.symbol).takerFee,
        reduceOnly: input.reduceOnly,
        takeProfit: input.takeProfit,
        stopLoss: input.stopLoss,
      })
    }
    if (tif === "IOC" || tif === "FOK") {
      throw new TradingError(`Ordem ${tif} não pôde ser executada imediatamente e foi cancelada`)
    }

    const { data, error } = await admin.rpc("futures_place_order", {
      p_user: userId,
      p_is_demo: isDemo,
      p_symbol: market.symbol,
      p_side: input.side,
      p_order_type: "limit",
      p_price: price,
      p_trigger_price: null,
      p_trigger_direction: null,
      p_qty: qty,
      p_leverage: leverage,
      p_margin_mode: marginMode,
      p_contract_size: market.contractSize,
      p_quote_usd: quoteToUsd(market, price),
      p_fee_rate: paramsFor(market.symbol).makerFee,
      p_reduce_only: input.reduceOnly ?? false,
      p_post_only: tif === "PostOnly",
      p_time_in_force: tif,
      p_take_profit: input.takeProfit ?? null,
      p_stop_loss: input.stopLoss ?? null,
    })
    if (error) throw rpcError(error)
    return data
  }

  // Condicional (stop a mercado)
  const trigger = Number(input.triggerPrice)
  if (!Number.isFinite(trigger) || trigger <= 0) throw new TradingError("Informe um preço de disparo válido")
  if (Math.abs(trigger - ticker.price) / ticker.price < 1e-6) {
    throw new TradingError("Preço de disparo igual ao preço atual")
  }
  validateTpSl(input.side, trigger, input.takeProfit, input.stopLoss, market.priceDecimals)
  const direction = trigger > ticker.price ? "rise" : "fall"

  const { data, error } = await admin.rpc("futures_place_order", {
    p_user: userId,
    p_is_demo: isDemo,
    p_symbol: market.symbol,
    p_side: input.side,
    p_order_type: "conditional",
    p_price: null,
    p_trigger_price: trigger,
    p_trigger_direction: direction,
    p_qty: qty,
    p_leverage: leverage,
    p_margin_mode: marginMode,
    p_contract_size: market.contractSize,
    p_quote_usd: quoteToUsd(market, trigger),
    p_fee_rate: paramsFor(market.symbol).takerFee,
    p_reduce_only: input.reduceOnly ?? false,
    p_post_only: false,
    p_time_in_force: "GTC",
    p_take_profit: input.takeProfit ?? null,
    p_stop_loss: input.stopLoss ?? null,
  })
  if (error) throw rpcError(error)
  return data
}

export async function cancelOrder(userId: string, orderId: string, reason?: string) {
  if (isTestUser(userId)) return testEngine.cancelOrder(orderId, reason)
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("futures_cancel_order", {
    p_user: userId,
    p_order_id: orderId,
    p_status: reason ? "rejected" : "cancelled",
    p_reason: reason ?? null,
  })
  if (error) throw rpcError(error)
  return data
}

export async function cancelAllOrders(userId: string, isDemo: boolean, symbol?: string) {
  if (isTestUser(userId)) return testEngine.cancelAllOrders(isDemo, symbol)
  const admin = createAdminClient()
  let query = admin.from("futures_orders").select("id").eq("user_id", userId).eq("is_demo", isDemo).eq("status", "open")
  if (symbol) query = query.eq("symbol", symbol)
  const { data } = await query
  for (const o of data ?? []) await cancelOrder(userId, o.id as string)
  return { cancelled: data?.length ?? 0 }
}

export async function closePosition(userId: string, positionId: string, qty?: number, limitPrice?: number) {
  if (isTestUser(userId)) return testEngine.closePosition(positionId, qty, limitPrice)
  const admin = createAdminClient()
  const { data } = await admin
    .from("futures_positions")
    .select("*")
    .eq("id", positionId)
    .eq("user_id", userId)
    .eq("status", "open")
    .maybeSingle()
  if (!data) throw new TradingError("Posição não encontrada", 404)
  const pos = normalizePosition(data)
  const market = getMarket(pos.symbol)
  if (!market) throw new TradingError("Mercado inválido")

  const closeQty = qty ? Math.min(roundToStep(qty, market.qtyStep), pos.qty) : pos.qty
  if (closeQty <= 0) throw new TradingError("Quantidade inválida")
  const side = pos.side === "long" ? "sell" : "buy"

  if (limitPrice) {
    return placeOrder(userId, {
      account: pos.is_demo ? "demo" : "real",
      symbol: pos.symbol,
      side,
      orderType: "limit",
      qty: closeQty,
      price: limitPrice,
      leverage: pos.leverage,
      marginMode: pos.margin_mode,
      reduceOnly: true,
    })
  }

  await ensureMarketSettings()
  const raw = await getExecutionTicker(pos.symbol)
  if (!raw) throw new TradingError("Cotação indisponível no momento. Tente novamente.", 503)
  const ticker = withSpread(raw, paramsFor(pos.symbol).spreadBps)
  const price = side === "buy" ? ticker.ask || ticker.price : ticker.bid || ticker.price

  return rpcFill(admin, {
    userId,
    isDemo: pos.is_demo,
    market,
    side,
    qty: closeQty,
    price,
    leverage: pos.leverage,
    marginMode: pos.margin_mode,
    feeRate: paramsFor(market.symbol).takerFee,
    reduceOnly: true,
    execType: "close",
  })
}

export async function setTpSl(userId: string, positionId: string, tp: number | null, sl: number | null) {
  if (isTestUser(userId)) return testEngine.setTpSl(positionId, tp, sl)
  const admin = createAdminClient()
  const { data } = await admin
    .from("futures_positions")
    .select("*")
    .eq("id", positionId)
    .eq("user_id", userId)
    .eq("status", "open")
    .maybeSingle()
  if (!data) throw new TradingError("Posição não encontrada", 404)
  const pos = normalizePosition(data)
  const ticker = await getExecutionTicker(pos.symbol)
  const ref = ticker?.price ?? pos.entry_price
  validateTpSl(pos.side === "long" ? "buy" : "sell", ref, tp, sl, getMarket(pos.symbol)?.priceDecimals ?? 2, "preço atual")

  const { error } = await admin.rpc("futures_set_tpsl", {
    p_user: userId,
    p_position_id: positionId,
    p_take_profit: tp,
    p_stop_loss: sl,
  })
  if (error) throw rpcError(error)
  return { ok: true }
}

async function applyFunding(
  admin: SupabaseClient,
  positionId: string,
  rate: number,
  mark: number,
  market: FuturesMarket,
  fundingAt: number,
) {
  const { data, error } = await admin.rpc("futures_apply_funding", {
    p_position_id: positionId,
    p_rate: rate,
    p_mark: mark,
    p_quote_usd: quoteToUsd(market, mark),
    p_funding_time: new Date(fundingAt).toISOString(),
  })
  if (error) {
    console.error("[futures] funding falhou", positionId, error.message)
    return null
  }
  return data == null ? null : Number(data)
}

async function getOwnOpenPosition(admin: SupabaseClient, userId: string, positionId: string) {
  const { data } = await admin
    .from("futures_positions")
    .select("*")
    .eq("id", positionId)
    .eq("user_id", userId)
    .eq("status", "open")
    .maybeSingle()
  if (!data) throw new TradingError("Posição não encontrada", 404)
  return normalizePosition(data)
}

export async function setLeverage(userId: string, positionId: string, leverage: number) {
  if (isTestUser(userId)) throw new TradingError("Indisponível na conta de teste")
  const admin = createAdminClient()
  const pos = await getOwnOpenPosition(admin, userId, positionId)
  const market = getMarket(pos.symbol)
  if (!market) throw new TradingError("Mercado inválido")
  await ensureMarketSettings()
  const max = paramsFor(market.symbol).maxLeverage
  const lev = Math.min(Math.max(1, Math.floor(leverage)), max)
  const { data, error } = await admin.rpc("futures_set_leverage", {
    p_user: userId,
    p_position_id: positionId,
    p_leverage: lev,
    p_quote_usd: quoteToUsd(market, pos.entry_price),
  })
  if (error) throw rpcError(error)
  return data
}

export async function setTrailing(userId: string, positionId: string, distance: number | null) {
  if (isTestUser(userId)) throw new TradingError("Indisponível na conta de teste")
  const admin = createAdminClient()
  const pos = await getOwnOpenPosition(admin, userId, positionId)
  if (distance != null && (!Number.isFinite(distance) || distance <= 0 || distance >= pos.entry_price)) {
    throw new TradingError("Distância do trailing stop inválida")
  }
  const { error } = await admin
    .from("futures_positions")
    .update({ trailing_distance: distance, trailing_peak: null, updated_at: new Date().toISOString() })
    .eq("id", positionId)
    .eq("user_id", userId)
  if (error) throw rpcError(error)
  return { ok: true }
}

export async function closeAllPositions(userId: string, isDemo: boolean) {
  const admin = createAdminClient()
  let ids: string[]
  if (isTestUser(userId)) {
    const state = await testEngine.loadState(isDemo)
    ids = state.positions.map((p) => p.id)
  } else {
    const { data } = await admin
      .from("futures_positions")
      .select("id")
      .eq("user_id", userId)
      .eq("is_demo", isDemo)
      .eq("status", "open")
    ids = (data ?? []).map((r) => r.id as string)
  }
  const results = await Promise.allSettled(ids.map((id) => closePosition(userId, id)))
  const failed = results.filter((r) => r.status === "rejected").length
  return { closed: ids.length - failed, failed }
}

export async function transferFunds(userId: string, direction: "spot_to_futures" | "futures_to_spot", amount: number) {
  if (isTestUser(userId)) throw new TradingError("Indisponível na conta de teste")
  const value = Math.floor(amount * 100) / 100
  if (!(value > 0)) throw new TradingError("Informe um valor válido")
  const admin = createAdminClient()

  if (direction === "futures_to_spot") {
    // Em margem cruzada a perda nao realizada consome o saldo: nao deixa transferir esse valor.
    const { data } = await admin
      .from("futures_positions")
      .select("*")
      .eq("user_id", userId)
      .eq("is_demo", false)
      .eq("status", "open")
      .eq("margin_mode", "cross")
    const tickers = await getAllTickers()
    let loss = 0
    for (const row of data ?? []) {
      const p = normalizePosition(row)
      const market = getMarket(p.symbol)
      const t = tickers[p.symbol]
      if (!market || !t) continue
      const mark = markPrice(t)
      const pnl = p.qty * p.contract_size * (mark - p.entry_price) * (p.side === "long" ? 1 : -1) * quoteToUsd(market, mark)
      if (pnl < 0) loss += -pnl
    }
    const { data: bal } = await admin.from("user_balances").select("balance_real").eq("user_id", userId).maybeSingle()
    const available = Number(bal?.balance_real ?? 0) - loss
    if (value > available) {
      throw new TradingError(`Disponível para transferir: ${Math.max(available, 0).toFixed(2)} USD`)
    }
  }

  const { data, error } = await admin.rpc("futures_transfer", { p_user: userId, p_direction: direction, p_amount: value })
  if (error) throw rpcError(error)
  return data as { futures: number; spot: number }
}

/**
 * Processa ordens pendentes, TP/SL e liquidacoes a partir do preco atual.
 * Sem userId processa todas as contas (usado pelo cron).
 */
export async function sweep(userId?: string) {
  if (isTestUser(userId)) return testEngine.sweep()
  if (!userId) await testEngine.sweep().catch(() => {})
  if (!isSupabaseAdminConfigured()) return { processed: 0 }
  const admin = createAdminClient()

  let ordersQ = admin.from("futures_orders").select("*").eq("status", "open").limit(500)
  let posQ = admin.from("futures_positions").select("*").eq("status", "open").limit(1000)
  if (userId) {
    ordersQ = ordersQ.eq("user_id", userId)
    posQ = posQ.eq("user_id", userId)
  }
  const [{ data: orderRows }, { data: posRows }] = await Promise.all([ordersQ, posQ])
  const orders = (orderRows ?? []).map((r) => ({ ...normalizeOrder(r), user_id: r.user_id as string, is_demo: r.is_demo as boolean }))
  const positions = (posRows ?? []).map((r) => ({ ...normalizePosition(r), user_id: r.user_id as string }))
  if (orders.length === 0 && positions.length === 0) return { processed: 0 }

  const tickers: Record<string, Ticker> = await getAllTickers()
  await ensureMarketSettings()
  let processed = 0

  for (const o of orders) {
    const market = getMarket(o.symbol)
    const t = tickers[o.symbol]
    if (!market || !t) continue
    const last = t.price

    let fillPrice: number | null = null
    let isMaker = false
    let feeRate = paramsFor(market.symbol).takerFee
    if (o.order_type === "limit" && o.price != null) {
      const hit = o.side === "buy" ? last <= o.price : last >= o.price
      if (hit) {
        fillPrice = o.price
        isMaker = true
        feeRate = paramsFor(market.symbol).makerFee
      }
    } else if (o.order_type === "conditional" && o.trigger_price != null) {
      const hit = o.trigger_direction === "rise" ? last >= o.trigger_price : last <= o.trigger_price
      if (hit) fillPrice = o.side === "buy" ? t.ask || last : t.bid || last
    }
    if (fillPrice == null) continue

    try {
      if (o.reduce_only) {
        const pos = positions.find((p) => p.user_id === o.user_id && p.symbol === o.symbol && p.is_demo === o.is_demo)
        const opposite = pos && (pos.side === "long" ? "sell" : "buy") === o.side
        if (!pos || !opposite) {
          await cancelOrder(o.user_id, o.id, "Posição já encerrada")
          continue
        }
      }
      await rpcFill(admin, {
        userId: o.user_id,
        isDemo: o.is_demo,
        market,
        side: o.side,
        qty: o.qty,
        price: fillPrice,
        leverage: o.leverage,
        marginMode: o.margin_mode,
        feeRate,
        reduceOnly: o.reduce_only,
        takeProfit: o.take_profit,
        stopLoss: o.stop_loss,
        orderId: o.id,
        isMaker,
      })
      processed++
    } catch (e) {
      await cancelOrder(o.user_id, o.id, (e as Error).message).catch(() => {})
    }
  }

  const derivs = await getDerivatives(tickers)
  const fundingAt = lastFundingTime()

  for (const p of positions) {
    const market = getMarket(p.symbol)
    const t = tickers[p.symbol]
    if (!market || !t) continue
    const last = t.price
    const mark = derivs[p.symbol]?.markPrice ?? markPrice(t)
    const isLong = p.side === "long"

    // Funding: cobra uma vez por horario (00h/08h/16h UTC) as posicoes abertas antes dele.
    if (new Date(p.opened_at).getTime() <= fundingAt) {
      const amount = await applyFunding(admin, p.id, derivs[p.symbol]?.fundingRate ?? 0.0001, mark, market, fundingAt)
      if (amount != null) {
        const fresh = await getOpenPosition(admin, p.user_id, p.symbol, p.is_demo)
        if (fresh) Object.assign(p, fresh)
      }
    }

    // Trailing stop: acompanha a maxima (long) ou minima (short) desde a ativacao.
    let trailingStop: number | null = null
    if (p.trailing_distance != null && p.trailing_distance > 0) {
      const peak = p.trailing_peak == null ? last : isLong ? Math.max(p.trailing_peak, last) : Math.min(p.trailing_peak, last)
      if (peak !== p.trailing_peak) {
        await admin.from("futures_positions").update({ trailing_peak: peak }).eq("id", p.id).eq("status", "open")
      }
      trailingStop = isLong ? peak - p.trailing_distance : peak + p.trailing_distance
    }

    let price: number | null = null
    let execType = "trade"
    let feeRate = paramsFor(market.symbol).takerFee
    // A liquidacao usa o preco de marcacao; TP/SL usam o ultimo negocio (padrao das corretoras).
    if (p.liquidation_price != null && (isLong ? mark <= p.liquidation_price : mark >= p.liquidation_price)) {
      price = p.liquidation_price
      execType = "liquidation"
      feeRate = 0
    } else if (p.stop_loss != null && (isLong ? last <= p.stop_loss : last >= p.stop_loss)) {
      price = last
      execType = "stop_loss"
    } else if (trailingStop != null && (isLong ? last <= trailingStop : last >= trailingStop)) {
      price = last
      execType = "trailing_stop"
    } else if (p.take_profit != null && (isLong ? last >= p.take_profit : last <= p.take_profit)) {
      price = last
      execType = "take_profit"
    }
    if (price == null) continue

    try {
      // Re-le a posicao: uma ordem acima pode ter mudado a quantidade.
      const fresh = await getOpenPosition(admin, p.user_id, p.symbol, p.is_demo)
      if (!fresh || fresh.id !== p.id) continue
      await rpcFill(admin, {
        userId: p.user_id,
        isDemo: p.is_demo,
        market,
        side: isLong ? "sell" : "buy",
        qty: fresh.qty,
        price,
        leverage: fresh.leverage,
        marginMode: fresh.margin_mode,
        feeRate,
        reduceOnly: true,
        execType,
      })
      processed++
    } catch (e) {
      console.error("[futures] erro ao encerrar posicao", p.id, (e as Error).message)
    }
  }

  return { processed }
}

export async function loadState(userId: string, isDemo: boolean) {
  if (isTestUser(userId)) return testEngine.loadState(isDemo)
  const admin = createAdminClient()
  const [bal, positions, openOrders, orderHistory, fills, closed, funding] = await Promise.all([
    admin.from("user_balances").select("balance_real, balance_demo, balance_spot").eq("user_id", userId).maybeSingle(),
    admin
      .from("futures_positions")
      .select("*")
      .eq("user_id", userId)
      .eq("is_demo", isDemo)
      .eq("status", "open")
      .order("opened_at", { ascending: false }),
    admin
      .from("futures_orders")
      .select("*")
      .eq("user_id", userId)
      .eq("is_demo", isDemo)
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    admin
      .from("futures_orders")
      .select("*")
      .eq("user_id", userId)
      .eq("is_demo", isDemo)
      .neq("status", "open")
      .order("updated_at", { ascending: false })
      .limit(50),
    admin
      .from("futures_fills")
      .select("*")
      .eq("user_id", userId)
      .eq("is_demo", isDemo)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("futures_positions")
      .select("*")
      .eq("user_id", userId)
      .eq("is_demo", isDemo)
      .neq("status", "open")
      .order("closed_at", { ascending: false })
      .limit(50),
    admin
      .from("futures_funding")
      .select("id, symbol, rate, mark_price, amount, funding_time")
      .eq("user_id", userId)
      .eq("is_demo", isDemo)
      .order("funding_time", { ascending: false })
      .limit(50),
  ])

  const missingTable = [positions, openOrders, fills].find((r) => r.error?.message?.includes("futures_"))
  if (missingTable?.error) {
    throw new TradingError(
      "Banco de dados sem as tabelas de futuros. Rode scripts/200_futures_trading.sql no Supabase.",
      503,
    )
  }

  const real = Number(bal.data?.balance_real ?? 0)
  const demo = Number(bal.data?.balance_demo ?? 10000)
  return {
    balance: isDemo ? demo : real,
    balances: { real, demo },
    spotBalance: Number(bal.data?.balance_spot ?? 0),
    fundingHistory: (funding.data ?? []).map((r) => ({
      id: r.id as string,
      symbol: r.symbol as string,
      rate: Number(r.rate),
      mark_price: Number(r.mark_price),
      amount: Number(r.amount),
      funding_time: r.funding_time as string,
    })),
    positions: (positions.data ?? []).map(normalizePosition),
    openOrders: (openOrders.data ?? []).map(normalizeOrder),
    orderHistory: (orderHistory.data ?? []).map(normalizeOrder),
    fills: (fills.data ?? []).map(normalizeFill),
    closedPositions: (closed.data ?? []).map(normalizePosition),
  }
}

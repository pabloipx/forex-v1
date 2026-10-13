// Motor de futuros em memória usado pelo login de teste (sem banco de dados).
// Reproduz as mesmas regras de futures_fill / futures_place_order do SQL.
// Os dados ficam na memória do servidor e são perdidos quando ele reinicia.
import { randomUUID } from "node:crypto"
import { TradingError } from "./errors"
import { getAllTickers, getExecutionTicker } from "./prices"
import {
  getMarket,
  liquidationPrice,
  quoteToUsd,
  roundToStep,
  type FuturesMarket,
} from "./markets"
import type { AccountMode, Fill, Order, PlaceOrderInput, Position } from "./types"
import { ensureMarketSettings, paramsFor, withSpread } from "./market-settings"

const INITIAL_BALANCE = 10000
const EPS = 1e-12

interface Account {
  balance: number
  positions: Position[]
  closed: Position[]
  orders: Order[]
  fills: Fill[]
}

type Store = Record<AccountMode, Account>

const g = globalThis as unknown as { __fxTestStore?: Store }

function store(): Store {
  if (!g.__fxTestStore) {
    const fresh = (): Account => ({ balance: INITIAL_BALANCE, positions: [], closed: [], orders: [], fills: [] })
    g.__fxTestStore = { real: fresh(), demo: fresh() }
  }
  return g.__fxTestStore
}

const acc = (isDemo: boolean) => store()[isDemo ? "demo" : "real"]
const now = () => new Date().toISOString()

function validateTpSl(side: "buy" | "sell", ref: number, tp?: number | null, sl?: number | null) {
  if (tp != null) {
    if (side === "buy" && tp <= ref) throw new TradingError("Take Profit deve ser maior que o preço de entrada")
    if (side === "sell" && tp >= ref) throw new TradingError("Take Profit deve ser menor que o preço de entrada")
  }
  if (sl != null) {
    if (side === "buy" && sl >= ref) throw new TradingError("Stop Loss deve ser menor que o preço de entrada")
    if (side === "sell" && sl <= ref) throw new TradingError("Stop Loss deve ser maior que o preço de entrada")
  }
}

interface FillArgs {
  isDemo: boolean
  market: FuturesMarket
  side: "buy" | "sell"
  qty: number
  price: number
  leverage: number
  marginMode: Position["margin_mode"]
  feeRate: number
  reduceOnly?: boolean
  takeProfit?: number | null
  stopLoss?: number | null
  order?: Order
  orderType?: Order["order_type"]
  execType?: string
  isMaker?: boolean
}

function fill(a: FillArgs) {
  const account = acc(a.isDemo)
  const cs = a.market.contractSize
  const qu = quoteToUsd(a.market, a.price)
  const pos = account.positions.find((p) => p.symbol === a.market.symbol)
  const opposite = pos && (pos.side === "long" ? "sell" : "buy") === a.side

  let closeQty = 0
  let pnl = 0
  let released = 0
  let feeClose = 0
  if (pos && opposite) {
    closeQty = Math.min(a.qty, pos.qty)
    const dir = pos.side === "long" ? 1 : -1
    pnl = closeQty * cs * (a.price - pos.entry_price) * dir * qu
    released = (pos.margin * closeQty) / pos.qty
    feeClose = closeQty * cs * a.price * qu * a.feeRate
  }

  const openQty = a.reduceOnly ? 0 : a.qty - closeQty
  const marginOpen = openQty > EPS ? (openQty * cs * a.price * qu) / a.leverage : 0
  const feeOpen = openQty > EPS ? openQty * cs * a.price * qu * a.feeRate : 0
  const available = account.balance + released + pnl - feeClose
  if (openQty > EPS && available < marginOpen + feeOpen) throw new TradingError("Saldo insuficiente")

  account.balance = available
  let positionId = pos?.id ?? null

  if (pos && opposite) {
    pos.qty -= closeQty
    pos.margin -= released
    pos.realized_pnl += pnl
    pos.fees_paid += feeClose
    if (pos.qty <= EPS) {
      pos.qty = 0
      pos.margin = 0
      pos.status = a.execType === "liquidation" ? "liquidated" : "closed"
      pos.exit_price = a.price
      pos.close_reason = a.execType ?? "trade"
      pos.closed_at = now()
      account.positions = account.positions.filter((p) => p.id !== pos.id)
      account.closed.unshift(pos)
    }
  }

  if (openQty > EPS) {
    account.balance -= marginOpen + feeOpen
    const current = account.positions.find((p) => p.symbol === a.market.symbol)
    if (current) {
      const newQty = current.qty + openQty
      current.entry_price = (current.entry_price * current.qty + a.price * openQty) / newQty
      current.qty = newQty
      current.margin += marginOpen
      current.fees_paid += feeOpen
      current.liquidation_price = liquidationPrice(current.side, current.entry_price, current.leverage)
      if (a.takeProfit != null) current.take_profit = a.takeProfit
      if (a.stopLoss != null) current.stop_loss = a.stopLoss
      positionId = current.id
    } else {
      const side = a.side === "buy" ? "long" : "short"
      const created: Position = {
        id: randomUUID(),
        symbol: a.market.symbol,
        side,
        qty: openQty,
        entry_price: a.price,
        leverage: a.leverage,
        margin_mode: a.marginMode,
        margin: marginOpen,
        contract_size: cs,
        liquidation_price: liquidationPrice(side, a.price, a.leverage),
        take_profit: a.takeProfit ?? null,
        stop_loss: a.stopLoss ?? null,
        realized_pnl: 0,
        fees_paid: feeOpen,
        exit_price: null,
        close_reason: null,
        status: "open",
        is_demo: a.isDemo,
        opened_at: now(),
        closed_at: null,
      }
      account.positions.unshift(created)
      positionId = created.id
    }
  }

  const fee = feeClose + feeOpen
  const filledQty = closeQty + Math.max(openQty, 0)
  const order: Order = a.order ?? {
    id: randomUUID(),
    symbol: a.market.symbol,
    side: a.side,
    order_type: a.orderType ?? "market",
    price: null,
    trigger_price: null,
    trigger_direction: null,
    qty: a.qty,
    leverage: a.leverage,
    margin_mode: a.marginMode,
    reduce_only: a.reduceOnly ?? false,
    post_only: false,
    time_in_force: "IOC",
    take_profit: a.takeProfit ?? null,
    stop_loss: a.stopLoss ?? null,
    reserved_margin: 0,
    status: "filled",
    filled_price: null,
    filled_qty: 0,
    fee: 0,
    reject_reason: null,
    created_at: now(),
    updated_at: now(),
  }
  order.status = "filled"
  order.filled_price = a.price
  order.filled_qty = filledQty
  order.fee = fee
  order.updated_at = now()
  account.orders = account.orders.filter((o) => o.id !== order.id)
  account.orders.unshift(order)

  account.fills.unshift({
    id: randomUUID(),
    order_id: order.id,
    position_id: positionId,
    symbol: a.market.symbol,
    side: a.side,
    price: a.price,
    qty: filledQty,
    fee,
    realized_pnl: pnl,
    exec_type: a.execType ?? "trade",
    is_maker: a.isMaker ?? false,
    created_at: now(),
  })
  account.fills = account.fills.slice(0, 200)

  return { position_id: positionId, balance: account.balance, realized_pnl: pnl, fee }
}

export async function placeOrder(input: PlaceOrderInput) {
  const market = getMarket(input.symbol)
  if (!market) throw new TradingError("Mercado inválido")
  const qty = roundToStep(input.qty, market.qtyStep)
  if (qty < market.minQty) throw new TradingError(`Quantidade mínima: ${market.minQty} ${market.qtyUnit}`)
  if (qty > market.maxQty) throw new TradingError(`Quantidade máxima: ${market.maxQty} ${market.qtyUnit}`)

  const isDemo = input.account === "demo"
  const account = acc(isDemo)
  await ensureMarketSettings()
  const params = paramsFor(market.symbol)
  if (!params.enabled && !input.reduceOnly) throw new TradingError("Mercado suspenso para novas posições")
  const raw = await getExecutionTicker(market.symbol)
  if (!raw) throw new TradingError("Cotação indisponível no momento. Tente novamente.", 503)
  const ticker = withSpread(raw, params.spreadBps)

  const existing = account.positions.find((p) => p.symbol === market.symbol)
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
  const fillQty = input.reduceOnly && existing ? Math.min(qty, existing.qty) : qty
  const base = { isDemo, market, side: input.side, leverage, marginMode, reduceOnly: input.reduceOnly }

  if (input.orderType === "market") {
    validateTpSl(input.side, execPrice, input.takeProfit, input.stopLoss)
    return fill({ ...base, qty: fillQty, price: execPrice, feeRate: paramsFor(market.symbol).takerFee, takeProfit: input.takeProfit, stopLoss: input.stopLoss })
  }

  let price: number | null = null
  let trigger: number | null = null
  let direction: Order["trigger_direction"] = null
  let tif: Order["time_in_force"] = "GTC"

  if (input.orderType === "limit") {
    price = Number(input.price)
    if (!Number.isFinite(price) || price <= 0) throw new TradingError("Informe um preço válido")
    validateTpSl(input.side, price, input.takeProfit, input.stopLoss)
    tif = input.postOnly ? "PostOnly" : input.timeInForce ?? "GTC"
    const marketable = input.side === "buy" ? price >= execPrice : price <= execPrice
    if (marketable) {
      if (tif === "PostOnly") throw new TradingError("Ordem Post-Only seria executada imediatamente e foi cancelada")
      return fill({
        ...base,
        qty: fillQty,
        price: execPrice,
        feeRate: paramsFor(market.symbol).takerFee,
        takeProfit: input.takeProfit,
        stopLoss: input.stopLoss,
        orderType: "limit",
      })
    }
    if (tif === "IOC" || tif === "FOK") {
      throw new TradingError(`Ordem ${tif} não pôde ser executada imediatamente e foi cancelada`)
    }
  } else {
    trigger = Number(input.triggerPrice)
    if (!Number.isFinite(trigger) || trigger <= 0) throw new TradingError("Informe um preço de disparo válido")
    if (Math.abs(trigger - ticker.price) / ticker.price < 1e-6) throw new TradingError("Preço de disparo igual ao preço atual")
    validateTpSl(input.side, trigger, input.takeProfit, input.stopLoss)
    direction = trigger > ticker.price ? "rise" : "fall"
  }

  const refPrice = (price ?? trigger) as number
  const feeRate = input.orderType === "limit" ? paramsFor(market.symbol).makerFee : paramsFor(market.symbol).takerFee
  const reserve = input.reduceOnly
    ? 0
    : qty * market.contractSize * refPrice * quoteToUsd(market, refPrice) * (1 / leverage + feeRate)
  if (account.balance < reserve) throw new TradingError("Saldo insuficiente")
  account.balance -= reserve

  const order: Order = {
    id: randomUUID(),
    symbol: market.symbol,
    side: input.side,
    order_type: input.orderType,
    price,
    trigger_price: trigger,
    trigger_direction: direction,
    qty,
    leverage,
    margin_mode: marginMode,
    reduce_only: input.reduceOnly ?? false,
    post_only: tif === "PostOnly",
    time_in_force: tif,
    take_profit: input.takeProfit ?? null,
    stop_loss: input.stopLoss ?? null,
    reserved_margin: reserve,
    status: "open",
    filled_price: null,
    filled_qty: 0,
    fee: 0,
    reject_reason: null,
    created_at: now(),
    updated_at: now(),
  }
  account.orders.unshift(order)
  return { order_id: order.id, balance: account.balance }
}

function findOrder(orderId: string) {
  for (const isDemo of [false, true]) {
    const order = acc(isDemo).orders.find((o) => o.id === orderId && o.status === "open")
    if (order) return { order, account: acc(isDemo) }
  }
  return null
}

export async function cancelOrder(orderId: string, reason?: string) {
  const found = findOrder(orderId)
  if (!found) throw new TradingError("Ordem não encontrada", 404)
  const { order, account } = found
  account.balance += order.reserved_margin
  order.reserved_margin = 0
  order.status = reason ? "rejected" : "cancelled"
  order.reject_reason = reason ?? null
  order.updated_at = now()
  return { ok: true, balance: account.balance }
}

export async function cancelAllOrders(isDemo: boolean, symbol?: string) {
  const open = acc(isDemo).orders.filter((o) => o.status === "open" && (!symbol || o.symbol === symbol))
  for (const o of open) await cancelOrder(o.id)
  return { cancelled: open.length }
}

function findPosition(positionId: string) {
  for (const isDemo of [false, true]) {
    const pos = acc(isDemo).positions.find((p) => p.id === positionId)
    if (pos) return pos
  }
  return null
}

export async function closePosition(positionId: string, qty?: number, limitPrice?: number) {
  const pos = findPosition(positionId)
  if (!pos) throw new TradingError("Posição não encontrada", 404)
  const market = getMarket(pos.symbol)
  if (!market) throw new TradingError("Mercado inválido")
  const closeQty = qty ? Math.min(roundToStep(qty, market.qtyStep), pos.qty) : pos.qty
  if (closeQty <= 0) throw new TradingError("Quantidade inválida")
  const side = pos.side === "long" ? "sell" : "buy"

  if (limitPrice) {
    return placeOrder({
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
  return fill({
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

export async function setTpSl(positionId: string, tp: number | null, sl: number | null) {
  const pos = findPosition(positionId)
  if (!pos) throw new TradingError("Posição não encontrada", 404)
  const ticker = await getExecutionTicker(pos.symbol)
  validateTpSl(pos.side === "long" ? "buy" : "sell", ticker?.price ?? pos.entry_price, tp, sl)
  pos.take_profit = tp
  pos.stop_loss = sl
  return { ok: true }
}

export async function sweep() {
  const s = store()
  const hasWork = [s.real, s.demo].some((a) => a.positions.length > 0 || a.orders.some((o) => o.status === "open"))
  if (!hasWork) return { processed: 0 }
  const tickers = await getAllTickers()
  await ensureMarketSettings()
  let processed = 0

  for (const isDemo of [false, true]) {
    const account = acc(isDemo)
    for (const o of account.orders.filter((x) => x.status === "open")) {
      const market = getMarket(o.symbol)
      const t = tickers[o.symbol]
      if (!market || !t) continue
      const last = t.price
      let fillPrice: number | null = null
      let isMaker = false
      let feeRate = paramsFor(market.symbol).takerFee
      if (o.order_type === "limit" && o.price != null) {
        if (o.side === "buy" ? last <= o.price : last >= o.price) {
          fillPrice = o.price
          isMaker = true
          feeRate = paramsFor(market.symbol).makerFee
        }
      } else if (o.order_type === "conditional" && o.trigger_price != null) {
        if (o.trigger_direction === "rise" ? last >= o.trigger_price : last <= o.trigger_price) {
          fillPrice = o.side === "buy" ? t.ask || last : t.bid || last
        }
      }
      if (fillPrice == null) continue

      const pos = account.positions.find((p) => p.symbol === o.symbol)
      if (o.reduce_only && (!pos || (pos.side === "long" ? "sell" : "buy") !== o.side)) {
        await cancelOrder(o.id, "Posição já encerrada")
        continue
      }
      const reserve = o.reserved_margin
      account.balance += reserve
      o.reserved_margin = 0
      try {
        fill({
          isDemo,
          market,
          side: o.side,
          qty: o.reduce_only && pos ? Math.min(o.qty, pos.qty) : o.qty,
          price: fillPrice,
          leverage: o.leverage,
          marginMode: o.margin_mode,
          feeRate,
          reduceOnly: o.reduce_only,
          takeProfit: o.take_profit,
          stopLoss: o.stop_loss,
          order: o,
          isMaker,
        })
        processed++
      } catch (e) {
        o.status = "rejected"
        o.reject_reason = (e as Error).message
        o.updated_at = now()
      }
    }

    for (const p of [...account.positions]) {
      const market = getMarket(p.symbol)
      const t = tickers[p.symbol]
      if (!market || !t) continue
      const last = t.price
      const isLong = p.side === "long"
      let price: number | null = null
      let execType = "trade"
      let feeRate = paramsFor(market.symbol).takerFee
      if (p.liquidation_price != null && (isLong ? last <= p.liquidation_price : last >= p.liquidation_price)) {
        price = p.liquidation_price
        execType = "liquidation"
        feeRate = 0
      } else if (p.stop_loss != null && (isLong ? last <= p.stop_loss : last >= p.stop_loss)) {
        price = last
        execType = "stop_loss"
      } else if (p.take_profit != null && (isLong ? last >= p.take_profit : last <= p.take_profit)) {
        price = last
        execType = "take_profit"
      }
      if (price == null || !account.positions.includes(p)) continue
      fill({
        isDemo,
        market,
        side: isLong ? "sell" : "buy",
        qty: p.qty,
        price,
        leverage: p.leverage,
        marginMode: p.margin_mode,
        feeRate,
        reduceOnly: true,
        execType,
      })
      processed++
    }
  }
  return { processed }
}

/** Acesso somente leitura para o painel admin no modo teste. */
export function getTestAccounts() {
  const s = store()
  return { real: s.real, demo: s.demo }
}

export function adjustTestBalance(isDemo: boolean, delta: number) {
  const account = acc(isDemo)
  if (account.balance + delta < 0) throw new TradingError("Saldo resultante não pode ser negativo")
  account.balance += delta
  return account.balance
}

export async function loadState(isDemo: boolean) {
  const s = store()
  const account = acc(isDemo)
  return {
    balance: account.balance,
    balances: { real: s.real.balance, demo: s.demo.balance },
    positions: account.positions,
    openOrders: account.orders.filter((o) => o.status === "open"),
    orderHistory: account.orders.filter((o) => o.status !== "open").slice(0, 50),
    fills: account.fills.slice(0, 50),
    closedPositions: account.closed.slice(0, 50),
  }
}

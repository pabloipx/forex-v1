"use client"

import type React from "react"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Plus, Minus, ArrowUp, ArrowDown, X, TrendingUp, TrendingDown } from "lucide-react"
import { OTC_ASSETS } from "@/lib/price-engine/multi-asset-engine"

interface TradingPanelProps {
  balance: number
  currentPrice: number
  symbol: string
  symbolName?: string
  payout?: number
  onTrade: (direction: "CALL" | "PUT", amount: number, timeframe: number) => void
  disabled?: boolean
  timeframe: number
  onTimeframeChange: (tf: number) => void
  onOpenAssetSelector?: () => void
  onAssetChange?: (symbol: string) => void
}

const TIMEFRAMES = [60, 300, 600, 900]
const TIMEFRAME_LABELS = ["1m", "5m", "10m", "15m"]
const QUICK_AMOUNTS = [10, 25, 50, 100, 200, 500]

export function TradingPanel({
  balance,
  currentPrice,
  symbol,
  symbolName,
  payout = 95,
  onTrade,
  disabled,
  timeframe,
  onTimeframeChange,
  onOpenAssetSelector,
  onAssetChange,
}: TradingPanelProps) {
  const [amount, setAmount] = useState(10)
  const [inputValue, setInputValue] = useState("10")
  const [isEditingAmount, setIsEditingAmount] = useState(false)
  const [showAssetModal, setShowAssetModal] = useState(false)
  const [allPrices, setAllPrices] = useState<Record<string, { price: number; change: number }>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastTradeTime, setLastTradeTime] = useState(0)
  const [tfIndex, setTfIndex] = useState(() => {
    const idx = TIMEFRAMES.indexOf(timeframe)
    return idx >= 0 ? idx : 0
  })

  useEffect(() => {
    onTimeframeChange(TIMEFRAMES[tfIndex])
  }, [tfIndex, onTimeframeChange])

  useEffect(() => {
    const fetchAllPrices = async () => {
      try {
        const response = await fetch("/api/global/assets")
        const contentType = response.headers.get("content-type")
        if (response.ok && contentType?.includes("application/json")) {
          const data = await response.json()
          setAllPrices(data.prices || {})
        }
      } catch {
        // Silently fail
      }
    }

    fetchAllPrices()
    const interval = setInterval(fetchAllPrices, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!isEditingAmount) {
      setInputValue(amount.toString())
    }
  }, [amount, isEditingAmount])

  const handleTrade = useCallback(
    async (direction: "CALL" | "PUT") => {
      if (amount <= 0 || amount > balance || disabled || isSubmitting) {
        console.log("[v0] Trade bloqueado: validações básicas falharam")
        return
      }

      if (!currentPrice || currentPrice <= 0) {
        console.log("[v0] Trade bloqueado: preço inválido")
        return
      }

      const now = Date.now()
      if (now - lastTradeTime < 1000) {
        console.log("[v0] Trade bloqueado: cooldown ativo")
        return
      }

      setIsSubmitting(true)
      setLastTradeTime(now)

      try {
        console.log(`[v0] Iniciando trade ${direction}: R$ ${amount} em ${symbol}`)
        await onTrade(direction, amount, TIMEFRAMES[tfIndex])
        console.log("[v0] Trade executado com sucesso")
      } catch (error) {
        console.error("[v0] Erro ao executar trade:", error)
      } finally {
        setTimeout(() => {
          setIsSubmitting(false)
        }, 500)
      }
    },
    [amount, balance, disabled, currentPrice, onTrade, tfIndex, isSubmitting, symbol, lastTradeTime],
  )

  const handleSelectAsset = useCallback(
    (newSymbol: string) => {
      if (onAssetChange) {
        onAssetChange(newSymbol)
      }
      setShowAssetModal(false)
    },
    [onAssetChange],
  )

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".")
    setInputValue(value)
  }, [])

  const handleInputBlur = useCallback(() => {
    setIsEditingAmount(false)
    const numValue = Number.parseFloat(inputValue)
    if (!isNaN(numValue) && numValue > 0) {
      const clampedValue = Math.min(Math.max(1, numValue), balance)
      setAmount(clampedValue)
      setInputValue(clampedValue.toString())
    } else {
      setInputValue(amount.toString())
    }
  }, [inputValue, amount, balance])

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleInputBlur()
        ;(e.target as HTMLInputElement).blur()
      }
    },
    [handleInputBlur],
  )

  const potentialPayment = useMemo(() => amount + (amount * payout) / 100, [amount, payout])

  const formatBRL = useCallback((value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  }, [])

  const formatPrice = useCallback((price: number, sym: string) => {
    if (!price) return "---"
    if (sym.includes("BTC")) return price.toFixed(2)
    if (sym.includes("JPY")) return price.toFixed(3)
    return price.toFixed(5)
  }, [])

  const assetDisplay = useMemo(() => {
    const names: Record<string, string> = {
      EURUSD_OTC: "EUR/USD (OTC)",
      GBPUSD_OTC: "GBP/USD (OTC)",
      USDJPY_OTC: "USD/JPY (OTC)",
      AUDUSD_OTC: "AUD/USD (OTC)",
      BTCUSD_OTC: "BTC/USD (OTC)",
    }
    return names[symbol] || symbolName || symbol
  }, [symbol, symbolName])

  const assetFlag = useMemo(() => {
    if (symbol.includes("EUR")) return "🇪🇺"
    if (symbol.includes("GBP")) return "🇬🇧"
    if (symbol.includes("JPY")) return "🇯🇵"
    if (symbol.includes("AUD")) return "🇦🇺"
    if (symbol.includes("BTC")) return "₿"
    return "💱"
  }, [symbol])

  const canTrade = useMemo(() => {
    return !disabled && !isSubmitting && amount > 0 && amount <= balance && currentPrice > 0
  }, [disabled, isSubmitting, amount, balance, currentPrice])

  const tradeButtonState = useMemo(() => {
    if (isSubmitting) return "Processando..."
    if (amount > balance) return "Saldo insuficiente"
    if (amount <= 0) return "Valor inválido"
    if (currentPrice <= 0) return "Aguardando preço..."
    return null
  }, [isSubmitting, amount, balance, currentPrice])

  return (
    <>
      {showAssetModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAssetModal(false)} />

          <div
            className="relative w-full md:w-[420px] md:max-h-[70vh] border border-white/10 rounded-t-2xl md:rounded-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
            style={{ backgroundColor: "#121826" }}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <h2 className="text-white font-bold text-lg">Selecionar Ativo</h2>
              <button
                onClick={() => setShowAssetModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {OTC_ASSETS.map((asset) => {
                const assetPrice = allPrices[asset.symbol]?.price || 0
                const change = allPrices[asset.symbol]?.change || 0
                const isSelected = symbol === asset.symbol
                const isUp = change >= 0

                return (
                  <button
                    key={asset.symbol}
                    onClick={() => handleSelectAsset(asset.symbol)}
                    disabled={disabled}
                    className={`w-full flex items-center gap-4 px-4 py-4 hover:bg-white/5 transition-colors border-b border-white/5 ${
                      isSelected ? "bg-[#f97316]/10" : ""
                    } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="relative">
                      <span className="text-3xl">{asset.icon}</span>
                      <span className="absolute -bottom-1 -right-1 bg-orange-500 text-[7px] text-white px-1 rounded font-bold">
                        OTC
                      </span>
                    </div>

                    <div className="flex-1 text-left">
                      <div className="text-white font-semibold">{asset.name}</div>
                      <div className="text-[#f97316] text-sm font-medium">Payout 95%</div>
                    </div>

                    <div className="text-right">
                      <div className="text-white font-mono font-semibold">{formatPrice(assetPrice, asset.symbol)}</div>
                      <div
                        className={`flex items-center justify-end gap-1 text-sm ${isUp ? "text-[#f97316]" : "text-[#EF4444]"}`}
                      >
                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span>
                          {isUp ? "+" : ""}
                          {change.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    {isSelected && <div className="w-2 h-2 rounded-full bg-[#f97316]" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div
        className="border-t border-white/10 p-3 md:p-4 space-y-3 md:space-y-4"
        style={{ backgroundColor: "#121826" }}
      >
        <button
          onClick={() => !disabled && setShowAssetModal(true)}
          disabled={disabled}
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition border border-white/10 ${
            disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-white/5"
          }`}
          style={{ backgroundColor: "#1F2933" }}
        >
          <div className="relative">
            <span className="text-2xl">{assetFlag}</span>
            <span className="absolute -bottom-1 -right-1 bg-orange-500 text-[8px] text-white px-1 rounded font-bold">
              OTC
            </span>
          </div>
          <div className="flex-1 text-left">
            <div className="text-white font-bold text-sm">{assetDisplay}</div>
            <div className="text-[#f97316] font-semibold text-xs">Payout {payout}%</div>
          </div>
          <div className="text-right">
            <div className="text-white/60 text-xs">Pagamento</div>
            <div className="text-[#f97316] font-bold text-sm">{formatBRL(potentialPayment)}</div>
          </div>
        </button>

        <div>
          <div className="text-white/60 text-xs mb-2">Tempo</div>
          <div
            className="flex items-center justify-between rounded-lg px-3 py-3"
            style={{ backgroundColor: "#1F2933" }}
          >
            <button
              onClick={() => setTfIndex(Math.max(0, tfIndex - 1))}
              disabled={tfIndex === 0}
              className="w-10 h-10 rounded-full bg-[#2a3441] flex items-center justify-center hover:bg-[#3a4451] transition active:scale-95 disabled:opacity-50"
            >
              <Minus className="w-5 h-5 text-white" />
            </button>
            <span className="text-white font-bold text-xl">{TIMEFRAME_LABELS[tfIndex]}</span>
            <button
              onClick={() => setTfIndex(Math.min(TIMEFRAMES.length - 1, tfIndex + 1))}
              disabled={tfIndex === TIMEFRAMES.length - 1}
              className="w-10 h-10 rounded-full bg-[#2a3441] flex items-center justify-center hover:bg-[#3a4451] transition active:scale-95 disabled:opacity-50"
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div>
          <div className="text-white/60 text-xs mb-2">Investimento</div>
          <div
            className="flex items-center justify-between rounded-lg px-3 py-2"
            style={{ backgroundColor: "#1F2933" }}
          >
            <button
              onClick={() => setAmount(Math.max(1, amount - 5))}
              className="w-10 h-10 rounded-full bg-[#2a3441] flex items-center justify-center hover:bg-[#3a4451] transition active:scale-95"
            >
              <Minus className="w-5 h-5 text-white" />
            </button>

            <div className="flex-1 flex items-center justify-center">
              <div className="relative">
                <span className="text-white/60 text-lg mr-1">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={isEditingAmount ? inputValue : amount.toFixed(2).replace(".", ",")}
                  onChange={handleInputChange}
                  onFocus={() => {
                    setIsEditingAmount(true)
                    setInputValue(amount.toString())
                  }}
                  onBlur={handleInputBlur}
                  onKeyDown={handleInputKeyDown}
                  className="bg-transparent text-white font-bold text-xl w-24 text-center outline-none border-b-2 border-transparent focus:border-[#f97316] transition-colors"
                  style={{ caretColor: "#f97316" }}
                />
              </div>
            </div>

            <button
              onClick={() => setAmount(Math.min(balance, amount + 5))}
              className="w-10 h-10 rounded-full bg-[#2a3441] flex items-center justify-center hover:bg-[#3a4451] transition active:scale-95"
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="grid grid-cols-6 gap-1 mt-2">
            {QUICK_AMOUNTS.map((quickAmount) => (
              <button
                key={quickAmount}
                onClick={() => setAmount(Math.min(quickAmount, balance))}
                disabled={quickAmount > balance}
                className={`py-2 rounded text-xs font-semibold transition-all ${
                  amount === quickAmount
                    ? "bg-[#f97316] text-white"
                    : quickAmount > balance
                      ? "bg-[#1F2933] text-white/30 cursor-not-allowed"
                      : "bg-[#1F2933] text-white/70 hover:bg-[#2a3441] hover:text-white"
                }`}
              >
                {quickAmount}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={() => handleTrade("CALL")}
            disabled={!canTrade}
            className={`w-full bg-[#f97316] hover:bg-[#fb923c] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 text-lg rounded-lg transition-all flex items-center justify-center gap-2 ${
              isSubmitting ? "animate-pulse" : "active:scale-[0.98]"
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-sm">{tradeButtonState}</span>
              </div>
            ) : (
              <>
                <span>Comprar</span>
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                  <ArrowUp className="w-5 h-5" />
                </div>
              </>
            )}
          </button>

          {!canTrade && tradeButtonState && !isSubmitting && (
            <div className="text-center text-yellow-500 text-xs font-semibold">{tradeButtonState}</div>
          )}

          <div className="text-center">
            <div className="text-white/50 text-xs">Seu pagamento</div>
            <div className="text-[#f97316] font-bold text-lg">{formatBRL(potentialPayment)}</div>
          </div>

          <button
            onClick={() => handleTrade("PUT")}
            disabled={!canTrade}
            className={`w-full bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 text-lg rounded-lg transition-all flex items-center justify-center gap-2 ${
              isSubmitting ? "animate-pulse" : "active:scale-[0.98]"
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-sm">{tradeButtonState}</span>
              </div>
            ) : (
              <>
                <span>Vender</span>
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                  <ArrowDown className="w-5 h-5" />
                </div>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}

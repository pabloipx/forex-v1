"use client"

import useSWR from "swr"
import { RefreshCw } from "lucide-react"

export interface FxQuote {
  market_rate: number
  rate: number
  spread_percent: number
  min_deposit_usd: number
  max_deposit_usd: number
  source: string
  updated_at: string
}

const fetcher = async (url: string): Promise<FxQuote> => {
  const res = await fetch(url, { cache: "no-store" })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || "Cotacao indisponivel")
  return data
}

export function useUsdBrlQuote() {
  return useSWR<FxQuote>("/api/fx/usd-brl", fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
    dedupingInterval: 10_000,
  })
}

export const fmtUsd = (v: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const fmtBrl = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function usdToBrlClient(usd: number, rate: number) {
  return Math.ceil(usd * rate * 100 - 1e-9) / 100
}

function timeAgo(iso?: string) {
  if (!iso) return ""
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return "agora"
  const m = Math.round(s / 60)
  return m < 60 ? `há ${m} min` : `há ${Math.round(m / 60)} h`
}

interface PixAmountProps {
  amount: string
  onAmountChange: (formatted: string) => void
  parsedUsd: number
  minUsd: number
  maxUsd: number
  quote?: FxQuote
  quoteError?: Error
  quoteLoading: boolean
  onRetryQuote: () => void
}

const QUICK_USD = [100, 250, 500, 1000, 2500, 5000]

function formatTyping(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 9)
  if (!digits) return ""
  return (Number.parseInt(digits, 10) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function PixAmount({
  amount,
  onAmountChange,
  parsedUsd,
  minUsd,
  maxUsd,
  quote,
  quoteError,
  quoteLoading,
  onRetryQuote,
}: PixAmountProps) {
  const brl = quote && parsedUsd > 0 ? usdToBrlClient(parsedUsd, quote.rate) : 0
  const belowMin = parsedUsd > 0 && parsedUsd < minUsd
  const aboveMax = parsedUsd > maxUsd

  const updated = quote ? timeAgo(quote.updated_at) : ""

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="deposit-usd" className="text-sm text-[#9CA3AF]">
          Valor do depósito
        </label>
        <div className="flex items-baseline gap-2 border-b border-[#1F2933] pb-2 focus-within:border-[#2190ff]">
          <span className="text-xl font-medium text-[#6B7280]">US$</span>
          <input
            id="deposit-usd"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={amount}
            onChange={(e) => onAmountChange(formatTyping(e.target.value))}
            placeholder={fmtUsd(minUsd)}
            aria-describedby="deposit-usd-hint"
            className="w-full min-w-0 bg-transparent font-mono text-3xl font-semibold tabular-nums text-white outline-none placeholder:text-[#374151]"
          />
        </div>
        <p id="deposit-usd-hint" className={`text-xs ${belowMin || aboveMax ? "text-red-400" : "text-[#6B7280]"}`}>
          {aboveMax ? `Máximo de US$ ${fmtUsd(maxUsd)}` : `Mínimo de US$ ${fmtUsd(minUsd)}`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {QUICK_USD.filter((v) => v <= maxUsd).map((value) => {
          const active = Math.abs(parsedUsd - value) < 0.001
          return (
            <button
              key={value}
              type="button"
              disabled={value < minUsd}
              onClick={() => onAmountChange(fmtUsd(value))}
              aria-pressed={active}
              className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                active
                  ? "border-[#2190ff] bg-[#2190ff]/10"
                  : "border-[#1F2933] bg-[#0F141C] hover:border-[#2190ff]/60"
              }`}
            >
              <span className="text-sm font-semibold text-white">{`US$ ${value.toLocaleString("en-US")}`}</span>
              <span className="font-mono text-[11px] tabular-nums text-[#6B7280]">
                {quote ? `R$ ${fmtBrl(usdToBrlClient(value, quote.rate))}` : "—"}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-[#1F2933] pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-[#9CA3AF]">Você paga via PIX</span>
          <span
            aria-live="polite"
            className={`font-mono text-lg font-semibold tabular-nums ${quoteLoading && !quote ? "text-[#374151]" : "text-white"}`}
          >
            {`R$ ${brl > 0 ? fmtBrl(brl) : "0,00"}`}
          </span>
        </div>
        {quoteError ? (
          <button
            type="button"
            onClick={onRetryQuote}
            className="flex items-center gap-1.5 self-start text-xs text-red-400 hover:text-red-300"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Cotação indisponível · tentar de novo
          </button>
        ) : (
          <p className="text-xs text-[#6B7280]">
            {quote
              ? `1 USD = R$ ${quote.rate.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} · ${updated === "agora" ? "ao vivo" : `atualizado ${updated}`}`
              : "Buscando cotação..."}
          </p>
        )}
      </div>
    </div>
  )
}

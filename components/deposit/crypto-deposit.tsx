"use client"

import { Check, CheckCircle2, Copy, Loader2 } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useState } from "react"
import { CRYPTO_LIST, CRYPTO_MIN_USD, CRYPTO_OPTIONS, USD_TO_BRL, type CryptoType } from "@/lib/deposit/crypto"

interface CryptoDepositProps {
  cryptoType: CryptoType
  onCryptoTypeChange: (type: CryptoType) => void
  amountUsd: string
  onAmountUsdChange: (value: string) => void
  amountBrl: string
  txHash: string
  onTxHashChange: (value: string) => void
  showQR: boolean
  onShowQR: () => void
  onBack: () => void
  onSubmit: () => void
  loading: boolean
  success: boolean
  onFinish: () => void
}

export function CryptoDeposit({
  cryptoType,
  onCryptoTypeChange,
  amountUsd,
  onAmountUsdChange,
  amountBrl,
  txHash,
  onTxHashChange,
  showQR,
  onShowQR,
  onBack,
  onSubmit,
  loading,
  success,
  onFinish,
}: CryptoDepositProps) {
  const [copied, setCopied] = useState(false)
  const crypto = CRYPTO_OPTIONS[cryptoType]

  const copyWallet = async () => {
    try {
      await navigator.clipboard.writeText(crypto.wallet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-[#2190ff]/30 bg-[#121826] p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2190ff]/20">
          <CheckCircle2 className="h-8 w-8 text-[#2190ff]" />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-white">Depósito enviado para análise</h3>
          <p className="text-sm leading-relaxed text-[#9CA3AF]">
            Recebemos seu depósito de ${amountUsd} USD em {crypto.symbol} (R$ {amountBrl}).
          </p>
          <p className="text-sm leading-relaxed text-[#9CA3AF]">
            Nossa equipe confere a transação na rede {crypto.network} e libera o saldo assim que confirmar.
          </p>
        </div>
        <button
          type="button"
          onClick={onFinish}
          className="w-full rounded-xl bg-[#2190ff] py-3 font-semibold text-white transition-colors hover:bg-[#0b5ed7]"
        >
          Voltar ao Dashboard
        </button>
      </div>
    )
  }

  if (!showQR) {
    return (
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-white">Moedas disponíveis</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CRYPTO_LIST.map((option) => {
              const active = option.id === cryptoType
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onCryptoTypeChange(option.id)}
                  aria-pressed={active}
                  className={`relative flex min-h-24 items-center gap-4 rounded-lg px-6 py-5 text-left transition-colors ${
                    active
                      ? "bg-[#2a3142] ring-2 ring-[#2190ff]"
                      : "bg-[#262b3a] hover:bg-[#2d3344]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
                    style={{ backgroundColor: option.color }}
                  >
                    {option.glyph}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-base font-medium text-white">{option.name}</span>
                    <span className="text-sm leading-snug text-[#9CA3AF]">
                      {option.symbol} · Rede {option.network} · mín. US$ {CRYPTO_MIN_USD}
                    </span>
                  </span>
                  {active && (
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#2190ff]">
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor="crypto-amount" className="text-sm font-medium text-white">
            Valor em USD
          </label>
          <div className="relative">
            <span
              className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold"
              style={{ color: crypto.color }}
            >
              $
            </span>
            <input
              id="crypto-amount"
              type="number"
              inputMode="decimal"
              min={CRYPTO_MIN_USD}
              step="1"
              value={amountUsd}
              onChange={(e) => onAmountUsdChange(e.target.value)}
              placeholder={`Mínimo $${CRYPTO_MIN_USD}`}
              className="w-full rounded-xl border border-[#1F2933] bg-[#0B0F14] py-4 pl-10 pr-4 text-xl font-semibold text-white placeholder:text-[#4B5563] focus:border-[#2190ff] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-[#1F2933] bg-[#121826] p-4">
          <div className="flex flex-col">
            <p className="text-xs text-[#9CA3AF]">Equivalente em reais (1 USD = R$ {USD_TO_BRL.toFixed(2)})</p>
            <p className="text-2xl font-bold text-white">R$ {amountBrl}</p>
          </div>
          <span className="text-xs text-[#9CA3AF]">
            Mínimo ${CRYPTO_MIN_USD} (R$ {(CRYPTO_MIN_USD * USD_TO_BRL).toFixed(2)})
          </span>
        </div>

        <button
          type="button"
          onClick={onShowQR}
          disabled={Number(amountUsd) < CRYPTO_MIN_USD}
          className="w-full rounded-xl py-4 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: crypto.color }}
        >
          Continuar com {crypto.symbol}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-xl border border-[#1F2933] bg-[#121826] p-6">
        <div className="flex flex-col gap-1 text-center">
          <h3 className="text-lg font-semibold text-white">Depósito {crypto.name}</h3>
          <p className="text-sm text-[#9CA3AF]">
            Envie o equivalente a{" "}
            <span className="font-bold" style={{ color: crypto.color }}>
              ${amountUsd} USD em {crypto.symbol}
            </span>{" "}
            para a carteira abaixo
          </p>
        </div>

        <div className="flex justify-center">
          <div className="rounded-xl bg-white p-4">
            <QRCodeSVG value={crypto.wallet} size={180} level="H" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#9CA3AF]">Carteira</span>
            <span
              className="rounded-full px-2 py-0.5 font-semibold"
              style={{ color: crypto.color, backgroundColor: `${crypto.color}1A` }}
            >
              Rede {crypto.network}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-[#0B0F14] p-3">
            <code className="flex-1 break-all font-mono text-xs text-white">{crypto.wallet}</code>
            <button
              type="button"
              onClick={copyWallet}
              aria-label="Copiar endereço da carteira"
              className="rounded-lg bg-[#1A2332] p-2 transition-colors hover:bg-[#2A3442]"
            >
              {copied ? <Check className="h-4 w-4 text-[#2190ff]" /> : <Copy className="h-4 w-4 text-[#9CA3AF]" />}
            </button>
          </div>
        </div>

        <ul className="flex flex-col gap-2 border-t border-[#1F2933] pt-3 text-xs leading-relaxed text-[#9CA3AF]">
          <li>Envie apenas {crypto.symbol} para este endereço.</li>
          <li>Use somente a rede {crypto.network}. Envios em outra rede são perdidos.</li>
        </ul>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-[#1F2933] bg-[#121826] p-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="crypto-tx" className="text-sm font-medium text-white">
            Após enviar, informe o hash da transação (TX Hash)
          </label>
          <input
            id="crypto-tx"
            type="text"
            value={txHash}
            onChange={(e) => onTxHashChange(e.target.value)}
            placeholder="Cole o hash da transação"
            className="w-full rounded-lg border border-[#1F2933] bg-[#0B0F14] px-4 py-3 font-mono text-sm text-white placeholder:text-[#4B5563] focus:border-[#2190ff] focus:outline-none"
          />
          <p className="text-xs text-[#6B7280]">Copie o hash na sua carteira ou exchange. O depósito é aprovado manualmente pela nossa equipe.</p>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || !txHash.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: crypto.color }}
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Registrando...</span>
            </>
          ) : (
            <span>Confirmar depósito de ${amountUsd} em {crypto.symbol}</span>
          )}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="w-full py-2 text-sm text-[#9CA3AF] transition-colors hover:text-white"
        >
          Voltar e alterar valor
        </button>
      </div>
    </div>
  )
}

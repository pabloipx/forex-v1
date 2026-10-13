"use client"

import type React from "react"

import { useCallback, useEffect, useState } from "react"
import { CalendarDays, CheckCircle2, CircleDashed, Download, Loader2, Plus, Trash2 } from "lucide-react"
import {
  shortDate,
  PAYMENT_METHOD_INFO,
  type AffiliateInfo,
  type AffiliatePaymentMethod,
  type AffiliateWithdrawal,
} from "./types"
import { useMoney, useCurrencyConverter } from "./currency-context"
import { PaymentMethodDrawer } from "./payment-method-drawer"

interface SectionPaymentsProps {
  affiliate: AffiliateInfo
  withdrawals: AffiliateWithdrawal[]
  nextPayment: string
  onRefresh: () => void
}

export function SectionPayments({ affiliate, withdrawals, nextPayment, onRefresh }: SectionPaymentsProps) {
  const brl = useMoney()
  const { toBRL, fromBRL, symbol } = useCurrencyConverter()
  const MIN_WITHDRAWAL = affiliate.min_withdrawal ?? 250
  const FEE_PERCENT = affiliate.withdrawal_fee_percent ?? 2

  const [tab, setTab] = useState<"payments" | "history" | "settings">("payments")
  const [amount, setAmount] = useState("")
  const [pixKeyType, setPixKeyType] = useState("cpf")
  const [pixKey, setPixKey] = useState("")
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [savedMethods, setSavedMethods] = useState<AffiliatePaymentMethod[]>([])
  const [loadingMethods, setLoadingMethods] = useState(true)
  const [methodsError, setMethodsError] = useState<string | null>(null)

  const canWithdraw = affiliate.balance >= MIN_WITHDRAWAL

  const loadMethods = useCallback(async () => {
    setMethodsError(null)
    try {
      const res = await fetch("/api/affiliate/payment-methods")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao carregar métodos de pagamento")
      setSavedMethods(json.methods ?? [])
    } catch (err) {
      setMethodsError(err instanceof Error ? err.message : "Erro ao carregar métodos de pagamento")
    } finally {
      setLoadingMethods(false)
    }
  }, [])

  useEffect(() => {
    loadMethods()
  }, [loadMethods])

  const removeMethod = async (id: string) => {
    setMethodsError(null)
    try {
      const res = await fetch(`/api/affiliate/payment-methods?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao remover método de pagamento")
      await loadMethods()
    } catch (err) {
      setMethodsError(err instanceof Error ? err.message : "Erro ao remover método de pagamento")
    }
  }

  const requestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    // O afiliado digita na moeda exibida, mas a API sempre trabalha em reais
    const value = toBRL(Number(amount))
    if (!value || value < MIN_WITHDRAWAL) {
      setMessage({ type: "error", text: `O valor mínimo para saque é ${brl(MIN_WITHDRAWAL)}` })
      return
    }
    if (value > affiliate.balance) {
      setMessage({ type: "error", text: "Saldo insuficiente para este saque" })
      return
    }
    if (!pixKey.trim()) {
      setMessage({ type: "error", text: "Informe a sua chave PIX" })
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      const res = await fetch("/api/affiliate/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, pixKey: pixKey.trim(), pixKeyType }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao solicitar saque")

      setMessage({ type: "ok", text: "Saque solicitado. O pagamento será processado em até 24h." })
      setAmount("")
      setPixKey("")
      onRefresh()
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro ao solicitar saque" })
    } finally {
      setSubmitting(false)
    }
  }

  const statusLabel = (status: string) => {
    if (status === "approved" || status === "completed" || status === "paid") return "Pago"
    if (status === "rejected" || status === "cancelled") return "Rejeitado"
    return "Em análise"
  }

  const statusClass = (status: string) => {
    if (status === "approved" || status === "completed" || status === "paid") return "bg-emerald-50 text-emerald-700"
    if (status === "rejected" || status === "cancelled") return "bg-red-50 text-red-600"
    return "bg-amber-50 text-amber-700"
  }

  const inputClass =
    "h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-semibold tracking-tight text-gray-900">Configurações de pagamento</h1>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Próximo pagamento</p>
            <CalendarDays className="h-5 w-5 text-gray-400" />
          </div>
          <p className="mt-4 text-[26px] font-semibold text-gray-900">{nextPayment}</p>
          <p className="mt-1 text-[15px] text-gray-500">Datas de pagamentos regulares</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Disponível para retirada</p>
            <Download className="h-5 w-5 text-gray-400" />
          </div>
          <p className="mt-4 text-[26px] font-semibold text-gray-900">{brl(affiliate.balance)}</p>
          <p className="mt-1 text-[15px] text-gray-500">Fundos disponíveis para você</p>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-gray-200">
        {(
          [
            { key: "payments", label: "Pagamentos" },
            { key: "history", label: "Histórico" },
            { key: "settings", label: "Configurações" },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`-mb-px border-b-2 pb-3 text-[15px] transition-colors ${
              tab === item.key
                ? "border-emerald-500 font-medium text-emerald-700"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "payments" && (
        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="rounded-t-xl bg-amber-50/60 px-6 py-5">
              <p className="text-[17px] font-medium text-gray-900">Pagamentos regulares</p>
              <p className="text-[15px] text-gray-600">{canWithdraw ? "Disponíveis" : "Indisponíveis"}</p>
            </div>

            <div className="flex flex-col gap-3 px-6 py-6">
              <p className="flex items-center gap-2 text-[15px] text-gray-800">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Conta de afiliado ativa
              </p>
              <div className="flex flex-col gap-1">
                <p className="flex items-center gap-2 text-[15px] text-gray-800">
                  {canWithdraw ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <CircleDashed className="h-5 w-5 text-gray-400" />
                  )}
                  Ter pelo menos {brl(MIN_WITHDRAWAL)} no saldo disponível
                </p>
                <p className="pl-7 text-sm text-gray-500">Seu saldo: {brl(affiliate.balance)}</p>
              </div>
            </div>
          </section>

          <form onSubmit={requestWithdrawal} className="rounded-xl border border-gray-200 bg-white p-6">
            <p className="text-[17px] font-medium text-gray-900">Solicitar pagamento via PIX</p>
            <p className="mt-1 text-[15px] text-gray-600">
            Taxa de {FEE_PERCENT}% sobre o valor solicitado
          </p>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <label htmlFor="pay-amount" className="text-[15px] text-gray-700">
                  Valor ({symbol})
                </label>
                <input
                  id="pay-amount"
                  type="number"
                  // O campo e digitado na moeda exibida, entao o minimo tambem e convertido
                  min={fromBRL(MIN_WITHDRAWAL).toFixed(2)}
                  step="0.01"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={submitting}
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="pay-key-type" className="text-[15px] text-gray-700">
                  Tipo de chave
                </label>
                <select
                  id="pay-key-type"
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value)}
                  disabled={submitting}
                  className={inputClass}
                >
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Telefone</option>
                  <option value="random">Chave aleatória</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="pay-key" className="text-[15px] text-gray-700">
                  Chave PIX
                </label>
                <input
                  id="pay-key"
                  type="text"
                  placeholder="Sua chave PIX"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  disabled={submitting}
                  className={inputClass}
                />
              </div>
            </div>

            {message && (
              <p
                className={`mt-4 rounded-lg px-3 py-2.5 text-sm ${
                  message.type === "ok"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-red-200 bg-red-50 text-red-600"
                }`}
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !canWithdraw}
              className="mt-5 flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-6 text-[15px] font-medium text-gray-900 transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Solicitar pagamento
            </button>
          </form>
        </div>
      )}

      {tab === "history" && (
        <section className="rounded-xl border border-gray-200 bg-white">
          {withdrawals.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <h2 className="text-[22px] font-semibold text-gray-900">Sem pagamentos</h2>
              <p className="mt-2 text-[15px] text-gray-600">Seus saques aparecerão aqui após a primeira solicitação.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-sm text-gray-600">
                  <tr>
                    <th className="px-6 py-3 font-medium">Data</th>
                    <th className="px-6 py-3 font-medium">Valor</th>
                    <th className="px-6 py-3 font-medium">Taxa</th>
                    <th className="px-6 py-3 font-medium">Líquido</th>
                    <th className="px-6 py-3 font-medium">Chave PIX</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="text-[15px] text-gray-800">
                  {withdrawals.map((withdrawal) => (
                    <tr key={withdrawal.id} className="border-t border-gray-100">
                      <td className="px-6 py-4">{shortDate(withdrawal.created_at)}</td>
                      <td className="px-6 py-4">{brl(withdrawal.amount)}</td>
                      <td className="px-6 py-4">{brl(withdrawal.fee)}</td>
                      <td className="px-6 py-4 font-medium">{brl(withdrawal.net_amount)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{withdrawal.pix_key}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-md px-2.5 py-1 text-sm font-medium ${statusClass(withdrawal.status)}`}
                        >
                          {statusLabel(withdrawal.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "settings" && (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="text-[19px] font-medium text-gray-900">Meus métodos de pagamento</h2>
            <p className="mt-1 text-[15px] text-gray-600">Adicionar métodos de pagamento alternativos</p>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="mt-4 flex h-12 items-center gap-2 rounded-lg bg-emerald-400 px-6 text-[15px] font-medium text-gray-900 transition-colors hover:bg-emerald-500"
            >
              Adicionar novo método
              <Plus className="h-4 w-4" />
            </button>

            {loadingMethods ? (
              <p className="mt-4 flex items-center gap-2 text-[15px] text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando métodos
              </p>
            ) : (
              savedMethods.length > 0 && (
                <ul className="mt-5 flex flex-col gap-3">
                  {savedMethods.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-gray-900">
                          {PAYMENT_METHOD_INFO[item.method].label}
                          {item.is_default && (
                            <span className="ml-2 rounded-md bg-emerald-50 px-2 py-0.5 text-sm font-medium text-emerald-700">
                              Padrão
                            </span>
                          )}
                        </p>
                        <p className="truncate text-sm text-gray-600">
                          {item.method === "usdt" ? item.wallet_address : `${item.pix_key_type} · ${item.pix_key}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMethod(item.id)}
                        aria-label={`Remover método ${PAYMENT_METHOD_INFO[item.method].label}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}

            {methodsError && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                {methodsError}
              </p>
            )}
          </section>

          <section>
            <h2 className="text-[19px] font-medium text-gray-900">Métodos disponíveis</h2>
            <p className="mt-1 text-[15px] text-gray-600">
              As taxas e o valor mínimo de retirada podem ser diferentes para cada método de pagamento.
            </p>

            <div className="mt-5 grid gap-6 md:grid-cols-2">
              {(Object.keys(PAYMENT_METHOD_INFO) as Array<keyof typeof PAYMENT_METHOD_INFO>).map((key) => {
                const info = PAYMENT_METHOD_INFO[key]
                return (
                  <article key={key} className="rounded-xl bg-gray-50 p-6">
                    <span className="flex h-12 w-[88px] items-center justify-center rounded-lg bg-white px-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={key === "usdt" ? "/logos/tether.svg" : "/logos/pix.svg"}
                        alt={info.label}
                        className="h-5 w-auto"
                      />
                    </span>

                    <p className="mt-5 text-[15px] text-gray-600">Este método de pagamento tem as seguintes taxas:</p>

                    <dl className="mt-4 flex flex-col gap-4">
                      <div>
                        <dt className="text-[15px] text-gray-500">Retirada regular mínima</dt>
                        <dd className="text-[17px] font-medium text-gray-900">${info.minRegular}</dd>
                      </div>
                      <div>
                        <dt className="text-[15px] text-gray-500">Retirada mínima solicitada</dt>
                        <dd className="text-[17px] font-medium text-gray-900">${info.minRequested}</dd>
                      </div>
                      <div>
                        <dt className="text-[15px] text-gray-500">Taxa de transferência</dt>
                        <dd className="text-[17px] font-medium text-gray-900">{info.fee}</dd>
                      </div>
                    </dl>

                    {info.note && <p className="mt-4 text-sm text-gray-500">{info.note}</p>}
                  </article>
                )
              })}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <p className="text-[17px] font-medium text-gray-900">Condições da sua conta</p>
            <dl className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-gray-200 p-4">
                <dt className="text-sm text-gray-500">Modelo</dt>
                <dd className="mt-1 text-[17px] font-semibold text-gray-900">
                  {affiliate.commission_model === "cpa"
                    ? "CPA"
                    : affiliate.commission_model === "revshare"
                      ? "RevShare"
                      : "Híbrido"}
                </dd>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <dt className="text-sm text-gray-500">RevShare</dt>
                <dd className="mt-1 text-[17px] font-semibold text-gray-900">{affiliate.commission_rate}%</dd>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <dt className="text-sm text-gray-500">CPA por indicação</dt>
                <dd className="mt-1 text-[17px] font-semibold text-gray-900">{brl(affiliate.cpa_amount ?? 0)}</dd>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <dt className="text-sm text-gray-500">Depósito mínimo do CPA</dt>
                <dd className="mt-1 text-[17px] font-semibold text-gray-900">{brl(affiliate.cpa_min_deposit ?? 0)}</dd>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <dt className="text-sm text-gray-500">Saque mínimo</dt>
                <dd className="mt-1 text-[17px] font-semibold text-gray-900">{brl(MIN_WITHDRAWAL)}</dd>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <dt className="text-sm text-gray-500">Taxa de saque</dt>
                <dd className="mt-1 text-[17px] font-semibold text-gray-900">{FEE_PERCENT}%</dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      <PaymentMethodDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onSaved={loadMethods} />
    </div>
  )
}

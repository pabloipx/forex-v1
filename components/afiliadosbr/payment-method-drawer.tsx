"use client"

import type React from "react"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, CreditCard, Loader2, Search, X } from "lucide-react"
import { PAYMENT_METHOD_INFO } from "./types"

type MethodKey = keyof typeof PAYMENT_METHOD_INFO

const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave aleatória" },
]

const fieldClass =
  "h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"

interface PaymentMethodDrawerProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function PaymentMethodDrawer({ open, onClose, onSaved }: PaymentMethodDrawerProps) {
  const [method, setMethod] = useState<MethodKey>("usdt")
  const [selectOpen, setSelectOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [walletAddress, setWalletAddress] = useState("")
  const [pixKey, setPixKey] = useState("")
  const [pixKeyType, setPixKeyType] = useState("cpf")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setMethod("usdt")
      setSelectOpen(false)
      setQuery("")
      setWalletAddress("")
      setPixKey("")
      setPixKeyType("cpf")
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (selectOpen) searchRef.current?.focus()
  }, [selectOpen])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const options = useMemo(() => {
    const list = (Object.keys(PAYMENT_METHOD_INFO) as MethodKey[]).map((key) => ({
      key,
      label: PAYMENT_METHOD_INFO[key].label,
    }))
    if (!query.trim()) return list
    return list.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
  }, [query])

  const info = PAYMENT_METHOD_INFO[method]
  const canSave = method === "usdt" ? walletAddress.trim().length >= 20 : pixKey.trim().length > 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || !canSave) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch("/api/affiliate/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, walletAddress, pixKey, pixKeyType }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao salvar método de pagamento")
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar método de pagamento")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/20 backdrop-blur-[2px]"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Adicionar método de pagamento"
        className="relative flex h-full w-full max-w-[516px] flex-col bg-white shadow-xl"
      >
        <div className="flex items-start justify-between px-8 pt-7">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
            <CreditCard className="h-5 w-5 text-emerald-600" />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-1 flex-col overflow-y-auto px-8 pb-6 pt-4">
          <h2 className="text-[22px] font-semibold text-gray-900">Adicionar método de pagamento</h2>

          <div className="mt-6 flex flex-col gap-2">
            <p className="text-[15px] text-gray-700">Método de pagamento</p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setSelectOpen((v) => !v)}
                aria-expanded={selectOpen}
                className={`${fieldClass} flex items-center justify-between text-left ${
                  selectOpen ? "border-emerald-500" : ""
                }`}
              >
                {info.label}
                {selectOpen ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </button>

              {selectOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-10 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      ref={searchRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      aria-label="Buscar método de pagamento"
                      className="h-10 w-full rounded-lg border border-emerald-500 bg-white pl-9 pr-3 text-[15px] text-gray-900 outline-none"
                    />
                  </div>
                  <ul className="mt-2 flex flex-col">
                    {options.length === 0 && <li className="px-2 py-2.5 text-[15px] text-gray-500">Nenhum resultado</li>}
                    {options.map((option) => (
                      <li key={option.key}>
                        <button
                          type="button"
                          onClick={() => {
                            setMethod(option.key)
                            setSelectOpen(false)
                            setQuery("")
                          }}
                          className={`w-full rounded-md px-2 py-2.5 text-left text-[15px] transition-colors hover:bg-gray-50 ${
                            method === option.key ? "font-medium text-gray-900" : "text-gray-700"
                          }`}
                        >
                          {option.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <p className="text-sm leading-relaxed text-gray-500">
              {`Retirada regular mínima $${info.minRegular}. Retirada mínima solicitada $${info.minRequested}. ${info.fee}.`}
            </p>
          </div>

          {method === "usdt" ? (
            <div className="mt-5 flex flex-col gap-2">
              <label htmlFor="drawer-wallet" className="text-[15px] text-gray-700">
                Endereço da carteira
              </label>
              <input
                id="drawer-wallet"
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                disabled={saving}
                className={fieldClass}
              />
              <p className="text-sm text-gray-500">Rede TRC-20. Confira o endereço antes de salvar.</p>
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="drawer-pix-type" className="text-[15px] text-gray-700">
                  Tipo de chave
                </label>
                <select
                  id="drawer-pix-type"
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value)}
                  disabled={saving}
                  className={fieldClass}
                >
                  {PIX_KEY_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="drawer-pix-key" className="text-[15px] text-gray-700">
                  Chave PIX
                </label>
                <input
                  id="drawer-pix-key"
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  disabled={saving}
                  className={fieldClass}
                />
              </div>
            </div>
          )}

          {info.note && <p className="mt-5 text-sm text-gray-500">{info.note}</p>}

          {error && (
            <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">{error}</p>
          )}
        </form>

        <div className="flex items-center gap-4 border-t border-gray-200 px-8 py-5">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-lg border border-gray-300 text-[15px] font-medium text-gray-800 transition-colors hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !canSave}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-400 text-[15px] font-medium text-gray-900 transition-colors hover:bg-emerald-500 disabled:bg-emerald-100 disabled:text-gray-400"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </button>
        </div>
      </aside>
    </div>
  )
}

"use client"

import type React from "react"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ChevronLeft, AlertCircle, Check, Wallet, Clock, Shield, AlertTriangle, CheckCircle, Bitcoin } from "lucide-react"
import Image from "next/image"

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000]
const USD_TO_BRL = 6.0

type WithdrawMethod = "pix" | "crypto"
type CryptoType = "usdt" | "btc"

export default function WithdrawPage() {
  const router = useRouter()
  const [withdrawMethod, setWithdrawMethod] = useState<WithdrawMethod>("pix")
  const [amount, setAmount] = useState("")
  const [pixKey, setPixKey] = useState("")
  const [pixKeyType, setPixKeyType] = useState("cpf")
  const [cryptoType, setCryptoType] = useState<CryptoType>("usdt")
  const [cryptoWallet, setCryptoWallet] = useState("")
  const [balance, setBalance] = useState(0)
  // Parte do saldo que ainda esta travada por um bonus com rollover em andamento.
  const [lockedBalance, setLockedBalance] = useState(0)
  const [rolloverInfo, setRolloverInfo] = useState<{
    required: number
    progress: number
    remaining: number
    cancelOnWithdrawal: boolean
  } | null>(null)
  // Trava do valor depositado: dinheiro do proprio usuario, preso ate cumprir o volume exigido.
  const [depositRollover, setDepositRollover] = useState<{
    lockedAmount: number
    rolloverRequired: number
    rolloverProgress: number
    remaining: number
    progressPercent: number
    depositsCount: number
  } | null>(null)
  const [withdrawalHours, setWithdrawalHours] = useState(72)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  const [kycStatus, setKycStatus] = useState<string | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [checkingKyc, setCheckingKyc] = useState(true)

  const supabase = useMemo(
    () => createClient(),
    [],
  )

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        router.push("/trade")
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [success, router])

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      const { data: balanceData } = await supabase
        .from("user_balances")
        .select("balance_real")
        .eq("user_id", user.id)
        .single()

      if (balanceData) {
        setBalance(balanceData.balance_real)
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("kyc_status, is_verified")
        .eq("id", user.id)
        .single()

      if (profile) {
        const status = profile.kyc_status?.toLowerCase().trim() || "unverified"
        setKycStatus(status)
        setIsVerified(profile.is_verified === true)
      } else {
        setKycStatus("unverified")
        setIsVerified(false)
      }

      // Situacao do rollover: define quanto do saldo esta realmente disponivel para saque.
      try {
        const promoResponse = await fetch("/api/promo/status")
        if (promoResponse.ok) {
          const promo = await promoResponse.json()
          if (promo.hasActiveBonus) {
            setLockedBalance(promo.lockedAmount)
            setRolloverInfo({
              required: promo.rolloverRequired,
              progress: promo.rolloverProgress,
              remaining: promo.remaining,
              cancelOnWithdrawal: promo.cancelsOnWithdrawal,
            })
          }
          if (promo.depositRollover) {
            setDepositRollover(promo.depositRollover)
          }
          if (promo.withdrawalHours) {
            setWithdrawalHours(promo.withdrawalHours)
          }
        }
      } catch {
        // Sem bloquear a tela: na falha, o servidor ainda aplica a trava no envio do saque.
      }

      setCheckingKyc(false)
    }

    loadData()
  }, [router, supabase])

  // Saldo realmente sacavel: o total menos o bonus em rollover e menos os depositos travados.
  const depositLocked = depositRollover?.lockedAmount || 0
  const availableBalance = Math.max(0, balance - lockedBalance - depositLocked)

  const isKycApproved = kycStatus === "approved" || isVerified === true
  const needsKyc = !isKycApproved

  const formatCurrency = useCallback((value: string) => {
    const numbers = value.replace(/\D/g, "")
    if (!numbers) return ""
    const numberValue = Number.parseInt(numbers) / 100
    return numberValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }, [])

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCurrency(e.target.value)
      setAmount(formatted)
    },
    [formatCurrency],
  )

  const handleQuickAmount = useCallback((value: number) => {
    setAmount(value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }, [])

  const parseAmount = useCallback(() => {
    if (!amount) return 0
    return Number.parseFloat(amount.replace(/\./g, "").replace(",", "."))
  }, [amount])

  const handleWithdraw = async () => {
    setError("")

    if (needsKyc) {
      setError("Você precisa verificar sua conta antes de sacar")
      return
    }

    const withdrawAmount = parseAmount()

    if (!withdrawAmount || withdrawAmount < 100) {
      setError("Valor mínimo para saque é R$ 100,00")
      return
    }

    if (withdrawMethod === "pix" && !pixKey.trim()) {
      setError("Informe sua chave PIX")
      return
    }

    if (withdrawMethod === "crypto" && !cryptoWallet.trim()) {
      setError("Informe o endereço da sua carteira")
      return
    }

    if (withdrawMethod === "crypto" && !cryptoWallet.startsWith("0x")) {
      setError("Endereço de carteira inválido. Deve começar com 0x")
      return
    }

    // Aviso antecipado: a trava de verdade e aplicada no servidor, isso so evita a ida perdida.
    if (withdrawAmount > availableBalance) {
      if (depositRollover && depositRollover.remaining > 0) {
        setError(
          `Você ainda tem R$ ${depositLocked.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em depósitos travados pelo rollover. ` +
            `Faltam R$ ${depositRollover.remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de volume em entradas para liberar esse valor. ` +
            `Saldo disponível para saque agora: R$ ${availableBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
        )
      } else if (lockedBalance > 0) {
        setError(
          `Saldo disponível para saque: R$ ${availableBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. ` +
            `Você tem R$ ${lockedBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em bônus travados pelo rollover. ` +
            `Faltam R$ ${(rolloverInfo?.remaining ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de volume em entradas para liberar.`,
        )
      } else {
        setError("Saldo insuficiente para realizar este saque")
      }
      return
    }

    setLoading(true)

    // O saque e criado pelo servidor (/api/withdraw), nao mais direto pelo navegador. Assim o saldo
    // e debitado UMA unica vez e a trava de rollover nao pode ser contornada pelo cliente.
    try {
      const response = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: withdrawAmount,
          method: withdrawMethod,
          pixKey: pixKey.trim(),
          pixKeyType,
          cryptoType: cryptoType.toUpperCase(),
          cryptoWallet: cryptoWallet.trim(),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || "Erro ao solicitar saque. Tente novamente.")
        setLoading(false)
        return
      }

      setBalance(result.newBalance)
      setLockedBalance(0)
      setSuccess(true)
    } catch (err) {
      console.error("[v0] Erro ao solicitar saque:", err)
      setError("Erro de conexao ao solicitar saque. Tente novamente.")
    }

    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0B0F14]">
        <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-[#f97316] flex items-center justify-center mb-4 shadow-lg shadow-[#f97316]/30">
            <Check className="w-8 h-8 text-white" strokeWidth={3} />
          </div>
          <p className="text-xl font-semibold text-[#fb923c] text-center">Saque solicitado com sucesso!</p>
          <p className="text-sm text-[#9CA3AF] mt-3 text-center max-w-xs text-pretty">
            {`O valor cairá na sua conta em até ${withdrawalHours} horas.`}
          </p>
          <p className="text-sm text-[#6B7280] mt-2">Redirecionando...</p>
        </div>
      </div>
    )
  }

  if (checkingKyc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F14]">
        <div className="w-8 h-8 border-2 border-[#f97316]/30 border-t-[#f97316] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B0F14]">
      <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 border-b border-[#1F2933] bg-[#0B0F14]">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-xl font-bold text-white">Saque</h1>
      </div>

      <div className="px-4 py-6 space-y-6 max-w-xl mx-auto">
        {isKycApproved ? (
          <div className="p-4 rounded-xl bg-[#f97316]/10 border border-[#f97316]/30">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-[#f97316] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[#f97316]">Conta Verificada</p>
                <p className="text-xs text-[#9CA3AF] mt-1">
                  Sua conta está verificada. Você pode realizar saques normalmente.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[#F59E0B]">Verificação Necessária</p>
                <p className="text-xs text-[#9CA3AF] mt-1">
                  {kycStatus === "pending"
                    ? "Seus documentos estão em análise. Você pode enviar novos documentos enquanto aguarda."
                    : kycStatus === "rejected"
                      ? "Sua verificação foi rejeitada. Envie novos documentos para continuar."
                      : "Para realizar saques, você precisa verificar sua conta."}
                </p>
                <button
                  onClick={() => router.push("/kyc")}
                  className="mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#F59E0B] hover:bg-[#D97706] transition-colors"
                >
                  {kycStatus === "pending"
                    ? "Enviar Documentos"
                    : kycStatus === "rejected"
                      ? "Reenviar Documentos"
                      : "Verificar Conta"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Method Selector */}
        <div className="space-y-2">
          <label className="text-white text-sm font-medium">Método de saque</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setWithdrawMethod("pix")}
              className={`p-4 rounded-xl border-2 transition-all ${
                withdrawMethod === "pix"
                  ? "border-[#f97316] bg-[#f97316]/10"
                  : "border-[#1F2933] bg-[#121826] hover:border-[#f97316]/50"
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                  withdrawMethod === "pix" ? "bg-white shadow-lg shadow-[#32BCAD]/20" : "bg-white/95"
                }`}>
                  <Image src="/pix-logo.png" alt="PIX" width={32} height={32} className="w-7 h-7 object-contain" />
                </div>
                <div className="text-center">
                  <p className={`font-semibold ${withdrawMethod === "pix" ? "text-[#f97316]" : "text-white"}`}>PIX</p>
                  <p className="text-[#9CA3AF] text-xs">Instantâneo</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setWithdrawMethod("crypto")}
              className={`p-4 rounded-xl border-2 transition-all ${
                withdrawMethod === "crypto"
                  ? "border-[#F7931A] bg-[#F7931A]/10"
                  : "border-[#1F2933] bg-[#121826] hover:border-[#F7931A]/50"
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  withdrawMethod === "crypto" ? "bg-[#F7931A]" : "bg-[#F7931A]/20"
                }`}>
                  <Bitcoin className="w-5 h-5 text-white" />
                </div>
                <div className="text-center">
                  <p className={`font-semibold ${withdrawMethod === "crypto" ? "text-[#F7931A]" : "text-white"}`}>Cripto</p>
                  <p className="text-[#9CA3AF] text-xs">USDT / BTC</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Method Header */}
        <div className="flex items-center gap-3">
          {withdrawMethod === "pix" ? (
            <>
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-lg shadow-[#32BCAD]/20">
                <Image src="/pix-logo.png" alt="PIX" width={32} height={32} className="w-7 h-7 object-contain" />
              </div>
              <div>
                <h2 className="text-white font-semibold">PIX</h2>
                <p className="text-sm text-[#9CA3AF]">Receba instantaneamente via PIX.</p>
              </div>
            </>
          ) : (
            <>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                cryptoType === "usdt" ? "bg-[#26A17B]" : "bg-[#F7931A]"
              }`}>
                <span className="text-white font-bold text-xl">{cryptoType === "usdt" ? "₮" : "₿"}</span>
              </div>
              <div>
                <h2 className="text-white font-semibold">{cryptoType === "usdt" ? "USDT (Tether)" : "Bitcoin (BTC)"}</h2>
                <p className="text-sm text-[#9CA3AF]">Receba em cripto na rede Ethereum (ERC-20)</p>
              </div>
            </>
          )}
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1A2332] to-[#121826] border border-[#1F2933]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#f97316]/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-[#f97316]" />
            </div>
  <p className="text-sm text-[#9CA3AF]">Saldo disponível para saque</p>
  </div>
  <p className="text-3xl font-bold text-white">
  R$ {availableBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
  </p>
  {/* Com rollover ativo, o saldo total nao e todo sacavel: mostramos cada parte travada. */}
  {(lockedBalance > 0 || depositLocked > 0) && (
  <div className="mt-3 pt-3 border-t border-[#1F2933] flex flex-col gap-1">
  <div className="flex items-center justify-between text-xs">
  <span className="text-[#9CA3AF]">Saldo total</span>
  <span className="text-[#9CA3AF]">
  R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
  </span>
  </div>
  {lockedBalance > 0 && (
  <div className="flex items-center justify-between text-xs">
  <span className="text-[#fb923c]">Bônus travado (rollover)</span>
  <span className="text-[#fb923c] font-medium">
  R$ {lockedBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
  </span>
  </div>
  )}
  {depositLocked > 0 && (
  <div className="flex items-center justify-between text-xs">
  <span className="text-[#fb923c]">Depósito travado (rollover)</span>
  <span className="text-[#fb923c] font-medium">
  R$ {depositLocked.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
  </span>
  </div>
  )}
  </div>
  )}
  </div>

  {/* Progresso do rollover, para o usuario saber exatamente quanto falta liberar o bonus */}
  {rolloverInfo && (
  <div className="p-4 rounded-2xl bg-[#f97316]/5 border border-[#f97316]/30 flex flex-col gap-3">
  <div className="flex items-start gap-3">
  <AlertTriangle className="w-5 h-5 text-[#fb923c] shrink-0 mt-0.5" />
  <div className="flex flex-col gap-1">
  <p className="text-sm font-medium text-[#fb923c]">Rollover em andamento</p>
  <p className="text-xs text-[#9CA3AF] leading-relaxed">
  {rolloverInfo.cancelOnWithdrawal
  ? `Faltam R$ ${rolloverInfo.remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de volume negociado. Sacar agora acima do saldo disponível cancela o bônus e remove o valor travado.`
  : `Faltam R$ ${rolloverInfo.remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de volume negociado para liberar o bônus para saque.`}
  </p>
  </div>
  </div>
  <div className="flex flex-col gap-1.5">
  <div className="h-2 rounded-full bg-[#1F2933] overflow-hidden">
  <div
  className="h-full rounded-full bg-[#f97316] transition-all"
  style={{
  width: `${rolloverInfo.required > 0 ? Math.min(100, (rolloverInfo.progress / rolloverInfo.required) * 100) : 100}%`,
  }}
  />
  </div>
  <p className="text-xs text-[#6B7280]">
  R$ {rolloverInfo.progress.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de R${" "}
  {rolloverInfo.required.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} negociados
  </p>
  </div>
  </div>
  )}

          {/* Progresso do rollover do valor depositado. Diferente do bonus, este valor nunca e
              perdido: fica apenas indisponivel para saque ate o volume ser cumprido. */}
          {depositRollover && (
            <div className="p-4 rounded-2xl bg-[#f97316]/5 border border-[#f97316]/30 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#fb923c] shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-[#fb923c]">
                    {depositRollover.depositsCount > 1
                      ? "Depósitos com rollover pendente"
                      : "Depósito com rollover pendente"}
                  </p>
                  <p className="text-xs text-[#9CA3AF] leading-relaxed">
                    {`Faltam R$ ${depositRollover.remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de volume negociado para liberar R$ ${depositRollover.lockedAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} para saque. O valor continua disponível para operar.`}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="h-2 rounded-full bg-[#1F2933] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#f97316] transition-all"
                    style={{ width: `${depositRollover.progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-[#6B7280]">
                  R$ {depositRollover.rolloverProgress.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de R${" "}
                  {depositRollover.rolloverRequired.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} negociados
                </p>
              </div>
            </div>
          )}

        <div>
          <label className="block text-sm text-white mb-2 font-medium">Valor do saque</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280] text-lg">R$</span>
            <input
              type="text"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0,00"
              disabled={needsKyc}
              className="w-full py-4 pl-12 pr-4 rounded-xl text-white text-lg font-semibold bg-[#121826] border border-[#1F2933] focus:border-[#f97316] outline-none transition-colors disabled:opacity-50"
            />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#f97316]" />
            <p className="text-xs text-[#9CA3AF]">Valor mínimo: R$ 100,00</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {QUICK_AMOUNTS.map((value) => (
            <button
              key={value}
              onClick={() => handleQuickAmount(value)}
              disabled={value > balance || needsKyc}
              className="py-3 px-2 rounded-xl text-sm font-medium text-white bg-[#121826] border border-[#1F2933] hover:border-[#f97316] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              R$ {value.toLocaleString("pt-BR")}
            </button>
          ))}
        </div>

        {withdrawMethod === "pix" ? (
          <>
            <div>
              <label className="block text-sm text-white mb-2 font-medium">Tipo de chave PIX</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: "cpf", label: "CPF" },
                  { value: "email", label: "E-mail" },
                  { value: "phone", label: "Celular" },
                  { value: "random", label: "Aleatória" },
                ].map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setPixKeyType(type.value)}
                    disabled={needsKyc}
                    className={`py-2.5 px-2 rounded-xl text-xs font-medium transition-colors disabled:opacity-50 ${
                      pixKeyType === type.value
                        ? "bg-[#f97316] text-white"
                        : "bg-[#121826] text-[#9CA3AF] border border-[#1F2933] hover:border-[#f97316]"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-white mb-2 font-medium">Chave PIX</label>
              <input
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                disabled={needsKyc}
                placeholder={
                  pixKeyType === "cpf"
                    ? "000.000.000-00"
                    : pixKeyType === "email"
                      ? "seu@email.com"
                      : pixKeyType === "phone"
                        ? "(00) 00000-0000"
                        : "Chave aleatória"
                }
                className="w-full py-4 px-4 rounded-xl text-white bg-[#121826] border border-[#1F2933] focus:border-[#f97316] outline-none transition-colors disabled:opacity-50"
              />
            </div>
          </>
        ) : (
          <>
            {/* Crypto Type Selector */}
            <div className="space-y-2">
              <label className="text-white text-sm font-medium">Escolha a criptomoeda</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setCryptoType("usdt")}
                  disabled={needsKyc}
                  className={`p-4 rounded-xl border-2 transition-all disabled:opacity-50 ${
                    cryptoType === "usdt"
                      ? "border-[#26A17B] bg-[#26A17B]/10"
                      : "border-[#1F2933] bg-[#121826] hover:border-[#26A17B]/50"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      cryptoType === "usdt" ? "bg-[#26A17B]" : "bg-[#26A17B]/20"
                    }`}>
                      <span className="text-white font-bold text-lg">₮</span>
                    </div>
                    <div className="text-center">
                      <p className={`font-semibold ${cryptoType === "usdt" ? "text-[#26A17B]" : "text-white"}`}>USDT</p>
                      <p className="text-[#9CA3AF] text-xs">Tether</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setCryptoType("btc")}
                  disabled={needsKyc}
                  className={`p-4 rounded-xl border-2 transition-all disabled:opacity-50 ${
                    cryptoType === "btc"
                      ? "border-[#F7931A] bg-[#F7931A]/10"
                      : "border-[#1F2933] bg-[#121826] hover:border-[#F7931A]/50"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      cryptoType === "btc" ? "bg-[#F7931A]" : "bg-[#F7931A]/20"
                    }`}>
                      <span className="text-white font-bold text-lg">₿</span>
                    </div>
                    <div className="text-center">
                      <p className={`font-semibold ${cryptoType === "btc" ? "text-[#F7931A]" : "text-white"}`}>BTC</p>
                      <p className="text-[#9CA3AF] text-xs">Bitcoin</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Crypto Wallet Address */}
            <div>
              <label className="block text-sm text-white mb-2 font-medium">Endereço da carteira (ERC-20)</label>
              <input
                type="text"
                value={cryptoWallet}
                onChange={(e) => setCryptoWallet(e.target.value)}
                disabled={needsKyc}
                placeholder="0x..."
                className="w-full py-4 px-4 rounded-xl text-white font-mono bg-[#121826] border border-[#1F2933] focus:border-[#f97316] outline-none transition-colors disabled:opacity-50"
              />
              <p className="text-xs text-[#9CA3AF] mt-2">
                Informe seu endereço de carteira Ethereum para receber {cryptoType === "usdt" ? "USDT" : "BTC"}.
              </p>
            </div>

            {/* USD Conversion */}
            <div className={`bg-[#121826] border rounded-xl p-4 ${cryptoType === "usdt" ? "border-[#26A17B]/30" : "border-[#F7931A]/30"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#9CA3AF] text-xs">Valor aproximado em USD (1 USD = R$ {USD_TO_BRL.toFixed(2)})</p>
                  <p className="text-white text-xl font-bold">
                    ${(parseAmount() / USD_TO_BRL).toFixed(2)} {cryptoType.toUpperCase()}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${cryptoType === "usdt" ? "bg-[#26A17B]/20" : "bg-[#F7931A]/20"}`}>
                  <span className={`text-xl font-bold ${cryptoType === "usdt" ? "text-[#26A17B]" : "text-[#F7931A]"}`}>
                    {cryptoType === "usdt" ? "₮" : "₿"}
                  </span>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-[#121826] border border-[#1F2933] rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-yellow-500 text-xs">!</span>
                </div>
                <p className="text-[#9CA3AF] text-xs">
                  Certifique-se de que o endereço está correto. Envios para endereços incorretos não podem ser recuperados.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-yellow-500 text-xs">!</span>
                </div>
                <p className="text-[#9CA3AF] text-xs">
                  Apenas endereços na rede Ethereum (ERC-20). Não use outras redes.
                </p>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20">
            <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0" />
            <p className="text-sm text-[#EF4444]">{error}</p>
          </div>
        )}

        <button
          onClick={handleWithdraw}
          disabled={
            loading || 
            parseAmount() < 100 || 
            parseAmount() > balance || 
            (withdrawMethod === "pix" && !pixKey.trim()) || 
            (withdrawMethod === "crypto" && !cryptoWallet.trim()) ||
            needsKyc
          }
          className={`w-full py-4 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
            withdrawMethod === "crypto" 
              ? cryptoType === "usdt" 
                ? "bg-[#26A17B] hover:bg-[#1f8a68]" 
                : "bg-[#F7931A] hover:bg-[#d97f15]"
              : "bg-[#f97316] hover:bg-[#fb923c]"
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processando...
            </span>
          ) : needsKyc ? (
            "Verifique sua conta primeiro"
          ) : withdrawMethod === "crypto" ? (
            `Sacar $${(parseAmount() / USD_TO_BRL).toFixed(2)} ${cryptoType.toUpperCase()}`
          ) : (
            `Sacar R$ ${amount || "0,00"}`
          )}
        </button>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-[#121826] border border-[#1F2933]">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-[#f97316]" />
              <p className="text-xs font-medium text-white">Prazo</p>
            </div>
            <p className="text-xs text-[#9CA3AF]">{`Até ${withdrawalHours} horas úteis`}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#121826] border border-[#1F2933]">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-[#f97316]" />
              <p className="text-xs font-medium text-white">Seguro</p>
            </div>
            <p className="text-xs text-[#9CA3AF]">Transferência protegida</p>
          </div>
        </div>
      </div>
    </div>
  )
}

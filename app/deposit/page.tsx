"use client"

import type React from "react"
import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ChevronLeft, Copy, Check, Loader2, Clock, RefreshCw, CreditCard, CheckCircle2, XCircle, X, Info, Sparkles, ShieldCheck, Lock } from "lucide-react"
import Image from "next/image"
import { QRCodeSVG } from "qrcode.react"

const QUICK_AMOUNTS = [50, 100, 500, 1000, 5000, 10000, 50000, 100000]

  interface PixPaymentData {
  deposit_id: string
  transaction_id: string
  qr_code: string
  qr_code_base64?: string
  copy_paste: string
  amount: number
  expires_at?: string
}

type DepositMethod = "pix" | "card" | "crypto"
type CryptoType = "usdt" | "btc"

const CRYPTO_WALLETS = {
  usdt: "0x4a46afb8Cd04C21FD1370ECbdC1C543352e55e60",
  btc: "0x49aE47169789c90D1bD9655E5cdA5a21F99CC058"
}
const CRYPTO_MIN_USD = 20
const USD_TO_BRL = 6.0 // Taxa de conversão USD para BRL

export default function DepositPage() {
  const router = useRouter()
  const [method, setMethod] = useState<DepositMethod>("pix")
  const [amount, setAmount] = useState("50,00")
  const [acceptTerms, setAcceptTerms] = useState(false)
  // Codigo promocional ja validado pelo servidor; enviado junto ao gerar o PIX.
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState("")
  const [promoMsg, setPromoMsg] = useState<string | null>(null)

  // PIX state
  const [pixData, setPixData] = useState<PixPaymentData | null>(null)
  const [pixCpf, setPixCpf] = useState("")
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(false)

  // Card state
  const [cardName, setCardName] = useState("")
  const [cardNumber, setCardNumber] = useState("")
  const [cardExpiry, setCardExpiry] = useState("")
  const [cardCvv, setCardCvv] = useState("")
  const [cardCpf, setCardCpf] = useState("")
  const [cardAmountSelected, setCardAmountSelected] = useState(false)
  const [cardSuccess, setCardSuccess] = useState(false)
  const [cardProcessing, setCardProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState(0)

  // Deposit methods enabled state
  const [cardEnabled, setCardEnabled] = useState(true)
  const [cryptoEnabled, setCryptoEnabled] = useState(false)
  const [cryptoCopied, setCryptoCopied] = useState(false)
  const [methodsLoading, setMethodsLoading] = useState(true)
  
  // Crypto form state
  const [cryptoType, setCryptoType] = useState<CryptoType>("usdt")
  const [cryptoAmountUsd, setCryptoAmountUsd] = useState("")
  const [cryptoTxHash, setCryptoTxHash] = useState("")
  const [cryptoSuccess, setCryptoSuccess] = useState(false)
  const [cryptoLoading, setCryptoLoading] = useState(false)
  const [showCryptoQR, setShowCryptoQR] = useState(false)
  
  // Current wallet based on crypto type
  const currentCryptoWallet = CRYPTO_WALLETS[cryptoType]
  
  // Computed BRL value based on USD amount for crypto
  const cryptoAmountBrl = useMemo(() => {
    const usdAmount = Number(cryptoAmountUsd) || 0
    return (usdAmount * USD_TO_BRL).toFixed(2)
  }, [cryptoAmountUsd])

  const supabase = useMemo(
    () => createClient(),
    [],
  )

  // Fetch deposit methods on mount
  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const res = await fetch("/api/settings/deposit-methods")
        const data = await res.json()
        setCardEnabled(data.card_enabled !== false)
        setCryptoEnabled(data.crypto_enabled === true)
        // If current method is disabled, switch to pix
        if (data.card_enabled === false && method === "card") {
          setMethod("pix")
        }
        if (data.crypto_enabled === false && method === "crypto") {
          setMethod("pix")
        }
      } catch (err) {
        console.error("Error fetching deposit methods:", err)
      } finally {
        setMethodsLoading(false)
      }
    }
    fetchMethods()
  }, [])

  // Timer de expiracao do QR Code
  useEffect(() => {
    if (!pixData?.expires_at) return

    const updateTimer = () => {
      const now = new Date().getTime()
      const expires = new Date(pixData.expires_at!).getTime()
      const diff = Math.max(0, Math.floor((expires - now) / 1000))
      setTimeLeft(diff)

      if (diff === 0) {
        setPixData(null)
        setError("QR Code expirado. Gere um novo.")
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [pixData?.expires_at])

  // Verificar status do pagamento periodicamente
  useEffect(() => {
    if (!pixData?.deposit_id) return

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/pix?deposit_id=${pixData.deposit_id}`)
        const data = await response.json()

        if (data.status === "approved" || data.status === "completed") {
          alert("Pagamento confirmado! Seu saldo foi atualizado.")
          router.push("/trade")
        }
      } catch (err) {
        console.error("Erro ao verificar status:", err)
      }
    }

    const interval = setInterval(checkStatus, 5000)

    // Quando o cliente volta para a aba (ex.: acabou de pagar no app do banco), reconcilia os
    // depositos pendentes na hora e checa o status — sem esperar o proximo ciclo de 5s nem
    // depender do webhook chegar imediatamente.
    const onReturn = () => {
      if (document.visibilityState !== "visible") return
      fetch("/api/deposits/reconcile", { method: "POST" })
        .catch(() => {})
        .finally(checkStatus)
    }
    document.addEventListener("visibilitychange", onReturn)
    window.addEventListener("focus", onReturn)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onReturn)
      window.removeEventListener("focus", onReturn)
    }
  }, [pixData?.deposit_id, router])

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
    if (method === "card") setCardAmountSelected(true)
  }, [method])

  const parseAmount = useCallback(() => {
    return Number.parseFloat(amount.replace(/\./g, "").replace(",", "."))
  }, [amount])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleCopyPaste = async () => {
    if (!pixData?.copy_paste) return
    try {
      await navigator.clipboard.writeText(pixData.copy_paste)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Erro ao copiar:", err)
    }
  }

  const handleCheckStatus = async () => {
    if (!pixData?.deposit_id) return
    setCheckingStatus(true)
    try {
      const response = await fetch(`/api/pix?deposit_id=${pixData.deposit_id}`)
      const data = await response.json()
      if (data.status === "approved" || data.status === "completed") {
        alert("Pagamento confirmado! Seu saldo foi atualizado.")
        router.push("/trade")
      } else {
        alert("Pagamento ainda nao confirmado. Aguarde alguns instantes.")
      }
    } catch (err) {
      console.error("Erro ao verificar status:", err)
    } finally {
      setCheckingStatus(false)
    }
  }

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 16)
    return clean.replace(/(\d{4})(?=\d)/g, "$1 ")
  }

  // Format expiry as MM/AA
  const formatExpiry = (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 4)
    if (clean.length >= 3) {
      return clean.slice(0, 2) + "/" + clean.slice(2)
    }
    return clean
  }

  // Format CPF as 000.000.000-00
  const formatCpf = (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 11)
    if (clean.length > 9) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4")
    if (clean.length > 6) return clean.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3")
    if (clean.length > 3) return clean.replace(/(\d{3})(\d{1,3})/, "$1.$2")
    return clean
  }

  // Valida CPF pelos digitos verificadores. A AmploPay rejeita CPF matematicamente invalido com
  // "Documento invalido" (GATEWAY_INVALID_DATA), entao barramos aqui antes de chamar o provedor.
  const isValidCpf = (raw: string): boolean => {
    const cpf = raw.replace(/\D/g, "")
    if (cpf.length !== 11) return false
    if (/^(\d)\1{10}$/.test(cpf)) return false // todos os digitos iguais
    let sum = 0
    for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i)
    let d1 = (sum * 10) % 11
    if (d1 === 10) d1 = 0
    if (d1 !== Number(cpf[9])) return false
    sum = 0
    for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i)
    let d2 = (sum * 10) % 11
    if (d2 === 10) d2 = 0
    return d2 === Number(cpf[10])
  }

  const handlePixDeposit = async () => {
    if (!acceptTerms) {
      setError("Voce precisa aceitar os termos e condicoes")
      return
    }
    const depositAmount = parseAmount()
    if (!depositAmount || depositAmount < 50) {
      setError("Valor minimo de R$ 50,00")
      return
    }
    if (depositAmount > 100000) {
      setError("Valor maximo de R$ 100.000,00")
      return
    }

    const cleanCpf = pixCpf.replace(/\D/g, "")
    if (!isValidCpf(cleanCpf)) {
      setError("CPF invalido. Confira os numeros e tente novamente.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: depositAmount,
          promoCode: appliedPromoCode,
          cpf: cleanCpf,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Erro ao processar deposito")

      setPixData({
        deposit_id: data.deposit_id,
        transaction_id: data.transaction_id,
        qr_code: data.qr_code || data.copy_paste,
        qr_code_base64: data.qr_code_base64 || "",
        copy_paste: data.copy_paste || data.qr_code,
        amount: data.amount,
        expires_at: data.expires_at,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar deposito")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCardDeposit = async () => {
    if (!acceptTerms) {
      setError("Voce precisa aceitar os termos e condicoes")
      return
    }

    const depositAmount = parseAmount()
    if (!depositAmount || depositAmount < 50) {
      setError("Valor minimo de R$ 50,00")
      return
    }

    if (!cardName.trim() || cardName.trim().length < 3) {
      setError("Informe o nome completo do titular")
      return
    }

    const cleanNum = cardNumber.replace(/\s/g, "")
    if (cleanNum.length < 13) {
      setError("Numero do cartao invalido")
      return
    }

    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      setError("Data de validade invalida")
      return
    }

    const cleanCvv = cardCvv.replace(/\D/g, "")
    if (cleanCvv.length < 3) {
      setError("CVV invalido")
      return
    }

    const cleanCpf = cardCpf.replace(/\D/g, "")
    if (!isValidCpf(cleanCpf)) {
      setError("CPF invalido. Confira os numeros e tente novamente.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/deposit/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: cardName.trim(),
          cardNumber: cleanNum,
          expiryDate: cardExpiry,
          cvv: cleanCvv,
          cpf: cleanCpf,
          amount: depositAmount,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Erro ao processar deposito")

      // Show processing animation
      setIsLoading(false)
      setCardProcessing(true)
      setProcessingStep(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar deposito")
      setIsLoading(false)
    }
  }

  // Show crypto QR code after validating amount
  const handleShowCryptoQR = () => {
    const numAmount = Number(cryptoAmountUsd)
    if (!numAmount || numAmount < CRYPTO_MIN_USD) {
      setError(`Valor minimo de $${CRYPTO_MIN_USD} USD (R$ ${(CRYPTO_MIN_USD * USD_TO_BRL).toFixed(2)})`)
      return
    }
    setError(null)
    setShowCryptoQR(true)
  }

  const handleCryptoDeposit = async () => {
    const numAmount = Number(cryptoAmountUsd)
    if (!numAmount || numAmount < CRYPTO_MIN_USD) {
      setError(`Valor minimo de $${CRYPTO_MIN_USD} USD`)
      return
    }

    if (!cryptoTxHash.trim() || cryptoTxHash.trim().length < 10) {
      setError("Informe o hash da transacao (TX Hash)")
      return
    }

    setCryptoLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/deposit/crypto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountUsd: numAmount,
          amountBrl: numAmount * USD_TO_BRL,
          txHash: cryptoTxHash.trim(),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Erro ao registrar deposito")

      setCryptoSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar deposito")
    } finally {
      setCryptoLoading(false)
    }
  }

  // Processing animation steps
  useEffect(() => {
    if (!cardProcessing) return

    const steps = [
      { delay: 1500, step: 1 }, // Verificando dados...
      { delay: 3000, step: 2 }, // Contactando operadora...
      { delay: 5000, step: 3 }, // Processando pagamento...
      { delay: 7000, step: 4 }, // Aguardando resposta...
      { delay: 9000, step: 5 }, // Declined
    ]

    const timers = steps.map(({ delay, step }) =>
      setTimeout(() => {
        if (step === 5) {
          setCardProcessing(false)
          setCardSuccess(true)
        } else {
          setProcessingStep(step)
        }
      }, delay)
    )

    return () => timers.forEach(clearTimeout)
  }, [cardProcessing])

  const handleNewDeposit = () => {
    setPixData(null)
    setCardSuccess(false)
    setCardProcessing(false)
    setProcessingStep(0)
    setError(null)
  }

  const handleApplyPromo = () => {
    if (!promoCode.trim()) return
    setPromoMsg("Código promocional inválido ou expirado.")
  }

  const pixCode = pixData?.copy_paste || pixData?.qr_code || ""

  const processingMessages = [
    "Verificando dados do cartao...",
    "Conectando com a operadora...",
    "Processando pagamento...",
    "Aguardando resposta da operadora...",
  ]

  // Card processing animation screen
  if (cardProcessing) {
    return (
      <div className="min-h-screen bg-[#0B0F14]">
        <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 border-b border-[#1F2933] bg-[#0B0F14]">
          <div className="p-2 -ml-2">
            <ChevronLeft className="w-6 h-6 text-white/20" />
          </div>
          <h1 className="text-xl font-bold text-white">Deposito via Cartao</h1>
        </div>
        <div className="px-4 py-16 max-w-xl mx-auto text-center">
          {/* Animated spinner */}
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-[#1F2933]" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#f97316] animate-spin" />
            <div className="absolute inset-3 rounded-full border-4 border-transparent border-t-[#f97316]/50 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <CreditCard className="w-8 h-8 text-[#f97316]" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-white mb-3">Processando pagamento</h2>
          <p className="text-white/60 mb-2">Valor: R$ {amount}</p>

          {/* Step indicators */}
          <div className="mt-8 space-y-3 text-left max-w-xs mx-auto">
            {processingMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 transition-all duration-500 ${
                  processingStep > i
                    ? "opacity-100"
                    : processingStep === i
                      ? "opacity-100"
                      : "opacity-20"
                }`}
              >
                {processingStep > i ? (
                  <div className="w-5 h-5 rounded-full bg-[#f97316]/20 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-[#f97316]" />
                  </div>
                ) : processingStep === i ? (
                  <Loader2 className="w-5 h-5 text-[#f97316] animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border border-[#1F2933] flex-shrink-0" />
                )}
                <span className={`text-sm ${processingStep >= i ? "text-white" : "text-white/40"}`}>
                  {msg}
                </span>
              </div>
            ))}
          </div>

          <p className="text-white/30 text-xs mt-8">Nao feche esta tela</p>
        </div>
      </div>
    )
  }

  // Card declined screen
  if (cardSuccess) {
    return (
      <div className="min-h-screen bg-[#0B0F14]">
        <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 border-b border-[#1F2933] bg-[#0B0F14]">
          <button onClick={handleNewDeposit} className="p-2 -ml-2">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">Deposito via Cartao</h1>
        </div>
        <div className="px-4 py-12 max-w-xl mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Pagamento recusado</h2>
          <p className="text-white/60 mb-2">Valor: R$ {amount}</p>
          <p className="text-white/40 text-sm mb-8">
            A processadora do seu cartao recusou a transacao. Por favor, tente novamente mais tarde ou utilize outro metodo de pagamento.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleNewDeposit}
              className="w-full py-4 rounded-xl font-semibold text-white bg-[#f97316] hover:bg-[#c2410c] transition-colors"
            >
              Tentar novamente
            </button>
            <button
              onClick={() => router.push("/trade")}
              className="w-full py-4 rounded-xl font-semibold text-white bg-[#1A2332] border border-[#1F2933] hover:border-[#f97316] transition-colors"
            >
              Voltar para o Trade
            </button>
          </div>
        </div>
      </div>
    )
  }

  // PIX QR Code screen
  if (pixData) {
    return (
      <div className="min-h-screen bg-[#0B0F14]">
        <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 border-b border-[#1F2933] bg-[#0B0F14]">
          <button onClick={handleNewDeposit} className="p-2 -ml-2">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">Pagamento PIX</h1>
        </div>

        <div className="px-4 py-6 space-y-6 max-w-xl mx-auto">
          {timeLeft !== null && timeLeft > 0 && (
            <div className="flex items-center justify-center gap-2 text-[#F59E0B]">
              <Clock className="w-5 h-5" />
              <span className="font-mono text-lg">Expira em {formatTime(timeLeft)}</span>
            </div>
          )}

          <div className="text-center">
            <p className="text-[#9CA3AF] text-sm">Valor do deposito</p>
            <p className="text-3xl font-bold text-white mt-1">
              R$ {pixData.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-2xl">
              {pixData?.qr_code_base64 ? (
                <img
                  src={`data:image/png;base64,${pixData.qr_code_base64}`}
                  alt="QR Code PIX"
                  width={220}
                  height={220}
                  className="w-[220px] h-[220px]"
                />
              ) : pixCode ? (
                <QRCodeSVG value={pixCode} size={220} level="M" includeMargin={false} bgColor="#ffffff" fgColor="#000000" />
              ) : (
                <div className="w-[220px] h-[220px] flex items-center justify-center text-gray-500 text-center p-4">
                  <p>QR Code nao disponivel. Use o codigo abaixo.</p>
                </div>
              )}
            </div>
          </div>

          <div className="text-center space-y-1">
            <p className="text-white font-medium">Escaneie o QR Code</p>
            <p className="text-[#9CA3AF] text-sm">Abra o app do seu banco e escaneie o codigo acima</p>
          </div>

          {pixCode && (
            <div className="space-y-3">
              <p className="text-sm text-[#9CA3AF] text-center">Ou copie o codigo PIX:</p>
              <div className="bg-[#121826] border border-[#1F2933] rounded-xl p-4 max-h-32 overflow-y-auto">
                <p className="text-white text-xs font-mono break-all leading-relaxed select-all">{pixCode}</p>
              </div>
              <button
                onClick={handleCopyPaste}
                className="w-full py-4 rounded-xl font-semibold text-white bg-[#f97316] hover:bg-[#fb923c] transition-colors flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Codigo copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    <span>Copiar codigo PIX</span>
                  </>
                )}
              </button>
            </div>
          )}

          <button
            onClick={handleCheckStatus}
            disabled={checkingStatus}
            className="w-full py-4 rounded-xl font-semibold text-white bg-[#1A2332] border border-[#1F2933] hover:border-[#f97316] transition-colors flex items-center justify-center gap-2"
          >
            {checkingStatus ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            <span>Ja fiz o pagamento</span>
          </button>

          <div className="bg-[#121826] border border-[#1F2933] rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-[#f97316] mt-2 flex-shrink-0" />
              <div>
                <p className="text-white text-sm font-medium">Pagamento instantaneo</p>
                <p className="text-[#9CA3AF] text-xs">Seu saldo sera creditado automaticamente apos a confirmacao</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-[#f97316] mt-2 flex-shrink-0" />
              <div>
                <p className="text-white text-sm font-medium">Seguro e protegido</p>
                <p className="text-[#9CA3AF] text-xs">Todas as transacoes sao criptografadas</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main deposit form
  const methodTitle =
    method === "pix"
      ? "PIX (Apenas seu CPF)"
      : method === "card"
        ? "Cartão de Crédito/Débito"
        : cryptoType === "usdt"
          ? "USDT (Tether)"
          : "Bitcoin (BTC)"

  return (
    <div className="min-h-screen bg-[#0d0d0f]">
      <div className="sticky top-0 z-10 px-4 sm:px-8 py-4 flex items-center gap-4 bg-[#0d0d0f]">
        <button
          onClick={() => router.back()}
          aria-label="Fechar"
          className="w-10 h-10 rounded-full bg-[#1c1c1f] hover:bg-[#26262a] flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5 text-white/80" />
        </button>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-[#9CA3AF] hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-base">Moeda</span>
        </button>
      </div>

      <div className="px-4 sm:px-8 py-6 max-w-5xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:gap-16">
          <div className="w-full lg:max-w-md space-y-6">
        {/* Method selector */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#6B7280] mb-2.5">Metodo de pagamento</p>
          <div className={`grid gap-2.5 ${cardEnabled && cryptoEnabled ? "grid-cols-3" : cardEnabled || cryptoEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
            <button
              onClick={() => { setMethod("pix"); setError(null) }}
              aria-pressed={method === "pix"}
              className={`group relative flex flex-col items-center gap-2 px-3 py-4 rounded-2xl border transition-all duration-200 overflow-hidden ${
                method === "pix"
                  ? "border-[#f97316] bg-gradient-to-b from-[#f97316]/15 to-transparent shadow-[0_0_0_1px_rgba(249,115,22,0.35),0_8px_24px_-8px_rgba(249,115,22,0.5)]"
                  : "border-[#1F2933] bg-[#121826] hover:border-[#374151] hover:bg-[#161d2b]"
              }`}
            >
              {method === "pix" && (
                <span className="absolute top-2 right-2 flex items-center justify-center w-4 h-4 rounded-full bg-[#f97316]">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </span>
              )}
              <span className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${method === "pix" ? "bg-white" : "bg-[#0d0d0f] group-hover:bg-white/95"}`}>
                <Image
                  src="/images/a57db68e-f6a1-44c5-bde8.jpeg"
                  alt="PIX"
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-md"
                />
              </span>
              <span className="flex flex-col items-center leading-tight">
                <span className={`text-sm font-bold ${method === "pix" ? "text-white" : "text-white/80"}`}>PIX</span>
                <span className="text-[10px] text-[#6B7280]">Aprovacao na hora</span>
              </span>
            </button>
            {cardEnabled && (
              <button
                onClick={() => { setMethod("card"); setError(null); setCardAmountSelected(false) }}
                aria-pressed={method === "card"}
                className={`group relative flex flex-col items-center gap-2 px-3 py-4 rounded-2xl border transition-all duration-200 overflow-hidden ${
                  method === "card"
                    ? "border-[#f97316] bg-gradient-to-b from-[#f97316]/15 to-transparent shadow-[0_0_0_1px_rgba(249,115,22,0.35),0_8px_24px_-8px_rgba(249,115,22,0.5)]"
                    : "border-[#1F2933] bg-[#121826] hover:border-[#374151] hover:bg-[#161d2b]"
                }`}
              >
                {method === "card" && (
                  <span className="absolute top-2 right-2 flex items-center justify-center w-4 h-4 rounded-full bg-[#f97316]">
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </span>
                )}
                <span className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${method === "card" ? "bg-[#f97316]" : "bg-[#0d0d0f] group-hover:bg-[#161d2b]"}`}>
                  <CreditCard className={`w-5 h-5 ${method === "card" ? "text-white" : "text-white/70"}`} />
                </span>
                <span className="flex flex-col items-center leading-tight">
                  <span className={`text-sm font-bold ${method === "card" ? "text-white" : "text-white/80"}`}>Cartao</span>
                  <span className="text-[10px] text-[#6B7280]">Credito / Debito</span>
                </span>
              </button>
            )}
            {cryptoEnabled && (
              <button
                onClick={() => { setMethod("crypto"); setError(null) }}
                aria-pressed={method === "crypto"}
                className={`group relative flex flex-col items-center gap-2 px-3 py-4 rounded-2xl border transition-all duration-200 overflow-hidden ${
                  method === "crypto"
                    ? "border-[#f97316] bg-gradient-to-b from-[#f97316]/15 to-transparent shadow-[0_0_0_1px_rgba(249,115,22,0.35),0_8px_24px_-8px_rgba(249,115,22,0.5)]"
                    : "border-[#1F2933] bg-[#121826] hover:border-[#374151] hover:bg-[#161d2b]"
                }`}
              >
                {method === "crypto" && (
                  <span className="absolute top-2 right-2 flex items-center justify-center w-4 h-4 rounded-full bg-[#f97316]">
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </span>
                )}
                <span className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${method === "crypto" ? "bg-[#26A17B]" : "bg-[#0d0d0f] group-hover:bg-[#161d2b]"}`}>
                  <span className={`text-lg font-bold ${method === "crypto" ? "text-white" : "text-white/70"}`}>₮</span>
                </span>
                <span className="flex flex-col items-center leading-tight">
                  <span className={`text-sm font-bold ${method === "crypto" ? "text-white" : "text-white/80"}`}>Cripto</span>
                  <span className="text-[10px] text-[#6B7280]">USDT / BTC</span>
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Title with icon */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center bg-white shrink-0">
            {method === "pix" ? (
              <Image src="/images/a57db68e-f6a1-44c5-bde8.jpeg" alt="PIX" width={36} height={36} className="w-full h-full object-cover" />
            ) : method === "card" ? (
              <CreditCard className="w-5 h-5 text-[#0d0d0f]" />
            ) : (
              <span className="text-[#0d0d0f] font-bold text-lg">{cryptoType === "usdt" ? "₮" : "₿"}</span>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-white text-balance">{methodTitle}</h1>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Amount - hide for crypto since it has its own USD input */}
        {method !== "crypto" && (
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">Valor</label>
            <div className="relative">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[#6B7280] text-lg">R$</span>
              <input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="50,00"
                className="w-full py-2 pl-8 pr-4 text-white text-lg bg-transparent border-0 border-b border-[#2a2a2e] focus:border-[#f97316] outline-none"
                inputMode="numeric"
              />
            </div>
          </div>
        )}

        {/* Quick amounts - hide for crypto */}
        {method !== "crypto" && (
          <div className="grid grid-cols-4 gap-3">
            {QUICK_AMOUNTS.map((value) => (
              <button
                key={value}
                onClick={() => handleQuickAmount(value)}
                className="py-3 px-2 rounded-lg text-sm font-medium text-white bg-[#151517] border border-[#26262a] hover:border-[#f97316] transition-colors"
              >
                R$ {value.toLocaleString("pt-BR")}
              </button>
            ))}
          </div>
        )}

        {/* PROMOÇÃO */}
        {method !== "crypto" && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-[#9CA3AF]">PROMOÇÃO</span>
              <button
                type="button"
                onClick={() => setPromoMsg("Nenhuma promoção disponível no momento.")}
                className="flex items-center gap-1 text-sm text-[#3b82f6] hover:text-[#60a5fa] transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Exibir disponíveis
              </button>
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value)
                  setPromoMsg(null)
                }}
                placeholder="Insira seu código promocional"
                className="flex-1 border-b border-[#2a2a2e] bg-transparent py-2 text-white outline-none placeholder:text-[#4b5563] focus:border-[#f97316]"
              />
              <button
                type="button"
                onClick={handleApplyPromo}
                className="rounded-md bg-[#1c1c1f] px-6 text-sm text-[#9CA3AF] transition-colors hover:bg-[#26262a]"
              >
                Aplicar
              </button>
            </div>
            <p className="mt-2 text-xs text-[#6b7280]">{promoMsg || "Um código promocional por depósito"}</p>
          </div>
        )}

        {/* DETALHES DO PAGAMENTO */}
        {method !== "crypto" && (
          <div>
            <span className="text-xs font-semibold tracking-wider text-[#9CA3AF]">DETALHES DO PAGAMENTO</span>
            <div className="mt-3 flex items-start gap-3 rounded-lg border border-[#26262a] bg-[#151517] p-4">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#9CA3AF]" />
              <p className="text-sm leading-relaxed text-[#9CA3AF]">
                Nossa plataforma não permite CNPJ, CPF de terceiros e/ou métodos de pagamento de terceiros. 90% dos
                pagamentos são processados pelo provedor em até 5 minutos.
              </p>
            </div>
          </div>
        )}

        {/* PIX: CPF do lead (usado para gerar a cobranca) */}
        {method === "pix" && (
          <div>
            <label className="block text-sm text-white mb-2 font-medium">CPF do titular</label>
            <input
              type="text"
              value={pixCpf}
              onChange={(e) => setPixCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              className="w-full py-4 px-4 rounded-xl text-white bg-[#121826] border border-[#1F2933] focus:border-[#f97316] outline-none"
              inputMode="numeric"
              autoComplete="off"
            />
            <p className="mt-2 text-xs text-[#6b7280]">Use apenas o seu proprio CPF. O PIX sera gerado com este documento.</p>
          </div>
        )}

        {/* Card: prompt to select amount */}
        {method === "card" && !cardAmountSelected && (
          <div className="p-4 rounded-xl bg-[#121826] border border-[#1F2933] text-center">
            <p className="text-white/60 text-sm">Selecione um valor acima para continuar</p>
          </div>
        )}

        {/* Card fields - only show after amount is selected */}
        {method === "card" && cardAmountSelected && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white mb-2 font-medium">Nome completo (titular)</label>
              <input
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="Nome como esta no cartao"
                className="w-full py-4 px-4 rounded-xl text-white bg-[#121826] border border-[#1F2933] focus:border-[#f97316] outline-none"
                autoComplete="cc-name"
              />
            </div>

            <div>
              <label className="block text-sm text-white mb-2 font-medium">Numero do cartao</label>
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="0000 0000 0000 0000"
                maxLength={19}
                className="w-full py-4 px-4 rounded-xl text-white bg-[#121826] border border-[#1F2933] focus:border-[#f97316] outline-none font-mono tracking-wider"
                inputMode="numeric"
                autoComplete="cc-number"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-white mb-2 font-medium">Validade</label>
                <input
                  type="text"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/AA"
                  maxLength={5}
                  className="w-full py-4 px-4 rounded-xl text-white bg-[#121826] border border-[#1F2933] focus:border-[#f97316] outline-none font-mono"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                />
              </div>
              <div>
                <label className="block text-sm text-white mb-2 font-medium">CVV</label>
                <input
                  type="text"
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="000"
                  maxLength={4}
                  className="w-full py-4 px-4 rounded-xl text-white bg-[#121826] border border-[#1F2933] focus:border-[#f97316] outline-none font-mono"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-white mb-2 font-medium">CPF do titular</label>
              <input
                type="text"
                value={cardCpf}
                onChange={(e) => setCardCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                className="w-full py-4 px-4 rounded-xl text-white bg-[#121826] border border-[#1F2933] focus:border-[#f97316] outline-none font-mono"
                inputMode="numeric"
              />
            </div>
          </div>
        )}

        {/* Crypto deposit section */}
        {method === "crypto" && (
          <div className="space-y-4">
            {cryptoSuccess ? (
              <div className="bg-[#121826] border border-green-500/30 rounded-xl p-6 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">Deposito Registrado!</h3>
                  <p className="text-[#9CA3AF] text-sm mt-2">Seu deposito de ${cryptoAmountUsd} USD (R$ {cryptoAmountBrl}) foi registrado com sucesso.</p>
                  <p className="text-[#9CA3AF] text-sm mt-1">Nossa equipe de analise liberara seu saldo em ate 15 minutos apos a confirmacao do pagamento.</p>
                </div>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full py-3 rounded-xl font-semibold text-white bg-[#f97316] hover:bg-[#c2410c] transition-colors"
                >
                  Voltar ao Dashboard
                </button>
              </div>
            ) : !showCryptoQR ? (
              <>
                {/* Crypto Type Selector */}
                <div className="space-y-2">
                  <label className="text-white text-sm font-medium">Escolha a criptomoeda</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setCryptoType("usdt")}
                      className={`p-4 rounded-xl border-2 transition-all ${
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
                      className={`p-4 rounded-xl border-2 transition-all ${
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

                {/* USD Amount Input */}
                <div className="space-y-2">
                  <label className="text-white text-sm font-medium">Valor em USD</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#26A17B] font-bold text-lg">$</span>
                    <input
                      type="number"
                      min={CRYPTO_MIN_USD}
                      step="1"
                      value={cryptoAmountUsd}
                      onChange={(e) => setCryptoAmountUsd(e.target.value)}
                      placeholder={`Minimo $${CRYPTO_MIN_USD}`}
                      className="w-full bg-[#0B0F14] border border-[#1F2933] rounded-xl py-4 pl-10 pr-4 text-white text-xl font-semibold placeholder:text-[#4B5563] focus:outline-none focus:border-[#26A17B]"
                    />
                  </div>
                </div>

                {/* BRL Conversion Display */}
                <div className={`bg-[#121826] border rounded-xl p-4 ${cryptoType === "usdt" ? "border-[#26A17B]/30" : "border-[#F7931A]/30"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#9CA3AF] text-xs">Equivalente em Reais (1 USD = R$ {USD_TO_BRL.toFixed(2)})</p>
                      <p className="text-white text-2xl font-bold">R$ {cryptoAmountBrl}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${cryptoType === "usdt" ? "bg-[#26A17B]/20" : "bg-[#F7931A]/20"}`}>
                      <span className={`text-xl font-bold ${cryptoType === "usdt" ? "text-[#26A17B]" : "text-[#F7931A]"}`}>
                        {cryptoType === "usdt" ? "₮" : "₿"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Warnings */}
                <div className="bg-[#121826] border border-[#1F2933] rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-yellow-500 text-xs">!</span>
                    </div>
                    <p className="text-[#9CA3AF] text-xs">
                      Envie apenas {cryptoType === "usdt" ? "USDT (Tether)" : "Bitcoin (BTC)"} na rede Ethereum (ERC-20)
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-green-500 text-xs">$</span>
                    </div>
                    <p className="text-[#9CA3AF] text-xs">Deposito minimo: <span className="text-white font-medium">${CRYPTO_MIN_USD} USD (R$ {(CRYPTO_MIN_USD * USD_TO_BRL).toFixed(2)})</span></p>
                  </div>
                </div>

                {/* Network badge */}
                <div className="flex justify-center">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1A2332] border ${cryptoType === "usdt" ? "border-[#26A17B]/30" : "border-[#F7931A]/30"}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${cryptoType === "usdt" ? "bg-[#26A17B]" : "bg-[#F7931A]"}`}>
                      <span className="text-white text-xs font-bold">{cryptoType === "usdt" ? "₮" : "₿"}</span>
                    </div>
                    <span className={`text-sm font-medium ${cryptoType === "usdt" ? "text-[#26A17B]" : "text-[#F7931A]"}`}>Rede Ethereum (ERC-20)</span>
                  </div>
                </div>

                {/* Pay button */}
                <button
                  onClick={handleShowCryptoQR}
                  disabled={Number(cryptoAmountUsd) < CRYPTO_MIN_USD}
                  className={`w-full py-4 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 ${
                    cryptoType === "usdt" ? "bg-[#26A17B] hover:bg-[#1f8a68]" : "bg-[#F7931A] hover:bg-[#d97f15]"
                  }`}
                >
                  Pagar ${cryptoAmountUsd || "0"} USD em {cryptoType.toUpperCase()}
                </button>
              </>
            ) : (
              <>
                <div className="bg-[#121826] border border-[#1F2933] rounded-xl p-6 space-y-4">
                  <div className="text-center">
                    <h3 className="text-white font-semibold text-lg mb-2">
                      Depositar {cryptoType === "usdt" ? "USDT" : "BTC"}
                    </h3>
                    <p className="text-[#9CA3AF] text-sm">
                      Envie <span className={`font-bold ${cryptoType === "usdt" ? "text-[#26A17B]" : "text-[#F7931A]"}`}>
                        ${cryptoAmountUsd} {cryptoType.toUpperCase()}
                      </span> para o endereco abaixo
                    </p>
                  </div>
                  
                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div className="bg-white p-4 rounded-xl">
                      <QRCodeSVG 
                        value={currentCryptoWallet} 
                        size={180}
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                  </div>

                  {/* Wallet address */}
                  <div className="space-y-2">
                    <p className="text-[#9CA3AF] text-xs text-center">Endereco de deposito (ERC-20)</p>
                    <div className="flex items-center gap-2 bg-[#0B0F14] rounded-lg p-3">
                      <code className="text-white text-xs flex-1 break-all font-mono">
                        {currentCryptoWallet}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(currentCryptoWallet)
                          setCryptoCopied(true)
                          setTimeout(() => setCryptoCopied(false), 2000)
                        }}
                        className="p-2 rounded-lg bg-[#1A2332] hover:bg-[#2A3442] transition-colors"
                      >
                        {cryptoCopied ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-[#9CA3AF]" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Warnings */}
                  <div className="space-y-2 pt-2 border-t border-[#1F2933]">
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-yellow-500 text-xs">!</span>
                      </div>
                      <p className="text-[#9CA3AF] text-xs">
                        Envie apenas {cryptoType === "usdt" ? "USDT (Tether)" : "Bitcoin (BTC)"} para este endereco
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-yellow-500 text-xs">!</span>
                      </div>
                      <p className="text-[#9CA3AF] text-xs">Rede Ethereum (ERC-20) apenas. Nao envie em outra rede.</p>
                    </div>
                  </div>
                </div>

                {/* TX Hash Form */}
                <div className="bg-[#121826] border border-[#1F2933] rounded-xl p-4 space-y-4">
                  <h4 className="text-white font-medium text-sm">Apos enviar, informe o hash da transacao:</h4>
                  
                  {/* TX Hash */}
                  <div className="space-y-2">
                    <label className="text-[#9CA3AF] text-xs">Hash da Transacao (TX Hash)</label>
                    <input
                      type="text"
                      value={cryptoTxHash}
                      onChange={(e) => setCryptoTxHash(e.target.value)}
                      placeholder="0x..."
                      className="w-full bg-[#0B0F14] border border-[#1F2933] rounded-lg py-3 px-4 text-white text-sm font-mono placeholder:text-[#4B5563] focus:outline-none focus:border-[#f97316]"
                    />
                    <p className="text-[#6B7280] text-xs">Copie o hash da transacao da sua carteira ou exchange</p>
                  </div>

                  {/* Submit button */}
                  <button
                    onClick={handleCryptoDeposit}
                    disabled={cryptoLoading || !cryptoTxHash.trim()}
                    className={`w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 ${
                      cryptoType === "usdt" ? "bg-[#26A17B] hover:bg-[#1f8a68]" : "bg-[#F7931A] hover:bg-[#d97f15]"
                    }`}
                  >
                    {cryptoLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Registrando...</span>
                      </>
                    ) : (
                      <span>Confirmar Deposito de ${cryptoAmountUsd} {cryptoType.toUpperCase()}</span>
                    )}
                  </button>

                  {/* Back button */}
                  <button
                    onClick={() => setShowCryptoQR(false)}
                    className="w-full py-2 text-[#9CA3AF] text-sm hover:text-white transition-colors"
                  >
                    Voltar e alterar valor
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Terms - only for PIX and Card */}
        {method !== "crypto" && (
          <div className="p-4 rounded-xl border-2 border-[#f97316] bg-[#121826]">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded border-[#f97316] bg-[#0B0F14] text-[#f97316] focus:ring-[#f97316] focus:ring-offset-0"
              />
              <div>
                <p className="text-[#f97316] text-sm font-medium">Termos e condicoes</p>
                <p className="text-[#9CA3AF] text-sm mt-1">Ao continuar, concordo com os Termos e condicoes.</p>
              </div>
            </label>
          </div>
        )}

        {/* Deposit button - only for PIX and Card */}
        {method !== "crypto" && (
          <button
            onClick={method === "pix" ? handlePixDeposit : handleCardDeposit}
            disabled={!acceptTerms || parseAmount() < 50 || isLoading}
            className="w-full py-4 rounded-xl font-semibold text-white bg-[#f97316] hover:bg-[#c2410c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{method === "pix" ? "Gerando QR Code..." : "Processando..."}</span>
              </>
            ) : (
              <span>
                {method === "pix" ? "Deposito PIX" : "Depositar via Cartao"} R$ {amount}
              </span>
            )}
          </button>
        )}

        {/* Card security info */}
        {method === "card" && (
          <div className="bg-[#121826] border border-[#1F2933] rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-[#f97316] mt-2 flex-shrink-0" />
              <div>
                <p className="text-white text-sm font-medium">Processamento seguro</p>
                <p className="text-[#9CA3AF] text-xs">Seus dados sao protegidos com criptografia de ponta a ponta</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-[#f97316] mt-2 flex-shrink-0" />
              <div>
                <p className="text-white text-sm font-medium">Aprovacao manual</p>
                <p className="text-[#9CA3AF] text-xs">Depositos via cartao sao verificados e aprovados pela equipe</p>
              </div>
            </div>
          </div>
        )}
          </div>

          {/* RIGHT COLUMN - selos de seguranca */}
          <div className="hidden lg:flex flex-1 flex-col gap-8 pt-2 opacity-40">
            <div className="flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-white/70" />
              <span className="text-sm leading-tight text-white/70">
                mastercard
                <br />
                ID Check
              </span>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-white/70" />
              <span className="text-sm leading-tight text-white/70">PCI DSS</span>
            </div>
            <div className="flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-white/70" />
              <span className="text-sm leading-tight text-white/70">
                VISA
                <br />
                Secure
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Lock className="h-8 w-8 text-white/70" />
              <span className="text-sm leading-tight text-white/70">
                SSL certified 256-bit
                <br />
                Security
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

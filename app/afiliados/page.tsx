"use client"

import { AffiliateTradeEditor } from "@/components/affiliate/affiliate-trade-editor"
import { InvitesChart } from "@/components/affiliate/invites-chart"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  ChevronLeft,
  Users,
  DollarSign,
  TrendingUp,
  Copy,
  Check,
  Wallet,
  History,
  Loader2,
  Share2,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Settings2,
} from "lucide-react"

interface Affiliate {
  id: string
  user_id: string
  code: string
  commission_rate: number
  commission_model: "revshare" | "cpa" | "hybrid"
  cpa_amount: number
  cpa_min_deposit: number
  sub_percent: number
  min_withdrawal: number
  withdrawal_fee_percent: number
  balance: number
  total_earned: number
  total_referrals: number
  referrals_with_deposit: number
  status: string
  created_at?: string
}

interface Referral {
  id: string
  referred_user_id: string
  status: string
  total_deposits: number
  total_commission: number
  revshare_commission?: number
  cpa_commission?: number
  created_at: string
  profiles: {
    full_name: string
    email: string
  }
}

interface Withdrawal {
  id: string
  amount: number
  fee?: number | null
  net_amount?: number | null
  status: string
  pix_key: string
  created_at: string
  updated_at: string | null
}

type TabType = "dashboard" | "referrals" | "operations" | "withdraw" | "history"

const brl = (value: number) =>
  "R$ " + Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Descreve os termos de comissao vigentes conforme o modelo definido pelo admin */
function termsSummary(a: Affiliate) {
  if (a.commission_model === "cpa") {
    return brl(a.cpa_amount) + " por indicado que depositar " + brl(a.cpa_min_deposit) + " ou mais"
  }
  if (a.commission_model === "hybrid") {
    return (
      brl(a.cpa_amount) +
      " no primeiro depósito de " +
      brl(a.cpa_min_deposit) +
      " ou mais, somado a " +
      a.commission_rate +
      "% de todos os depósitos"
    )
  }
  return a.commission_rate + "% sobre todos os depósitos dos seus indicados"
}

const MODEL_LABEL: Record<Affiliate["commission_model"], string> = {
  revshare: "RevShare",
  cpa: "CPA",
  hybrid: "Híbrido",
}

export default function AffiliatePage() {
  const router = useRouter()
  const [supabase] = useState(() =>
    createClient(),
  )

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [activeTab, setActiveTab] = useState<TabType>("dashboard")
  const [copied, setCopied] = useState(false)

  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [pixKey, setPixKey] = useState("")
  const [pixKeyType, setPixKeyType] = useState("cpf")
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState("")
  const [withdrawSuccess, setWithdrawSuccess] = useState(false)
  const [confirmation, setConfirmation] = useState<{ netAmount: number; pixKey: string } | null>(null)
  const [processingAnim, setProcessingAnim] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoadError("")
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }

      // First try to get affiliate data
      const response = await fetch("/api/affiliate")
      if (!response.ok) throw new Error("API error: " + response.status)
      const data = await response.json()
      if (data.error) throw new Error(data.error)

      if (data.affiliate) {
        setAffiliate(data.affiliate)
        setReferrals(data.referrals || [])
        setWithdrawals(data.withdrawals || [])
      } else {
        // User is not an affiliate yet - create affiliate account
        const createResponse = await fetch("/api/affiliate", { method: "POST" })
        if (!createResponse.ok) throw new Error("Create API error: " + createResponse.status)
        const createData = await createResponse.json()
        if (createData.error) throw new Error(createData.error)
        if (createData.affiliate) {
          setAffiliate(createData.affiliate)
          setReferrals([])
          setWithdrawals([])
        } else {
          throw new Error("Falha ao criar conta de afiliado")
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
      setLoadError(error instanceof Error ? error.message : "Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => {
    loadData()
  }, [loadData])

  const copyCode = () => {
    if (affiliate?.code) {
      const link = window.location.origin + "/auth/sign-up?ref=" + affiliate.code
      navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const copyLink = () => {
    if (affiliate?.code) {
      const link = window.location.origin + "/auth/sign-up?ref=" + affiliate.code
      navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleWithdraw = async () => {
    setWithdrawError("")
    setWithdrawSuccess(false)
    const amount = Number.parseFloat(withdrawAmount)
    const minWithdrawal = affiliate?.min_withdrawal ?? 0
    if (!amount || amount < minWithdrawal) {
      setWithdrawError("Valor mínimo para saque é " + brl(minWithdrawal))
      return
    }
    if (amount > (affiliate?.balance || 0)) {
      setWithdrawError("Saldo insuficiente")
      return
    }
    if (!pixKey) {
      setWithdrawError("Informe a chave PIX")
      return
    }
    setWithdrawing(true)
    try {
      const response = await fetch("/api/affiliate/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, pixKey, pixKeyType }),
      })
      const data = await response.json()
      if (data.error) {
        setWithdrawError(data.error)
      } else {
        const details = { netAmount: amount * 0.98, pixKey }
        setWithdrawSuccess(true)
        setWithdrawAmount("")
        setPixKey("")
        loadData()
        // Mostra a animacao de "sacando" antes de exibir o pop-up de confirmacao
        setProcessingAnim(true)
        setTimeout(() => {
          setProcessingAnim(false)
          setConfirmation(details)
        }, 2800)
      }
    } catch {
      setWithdrawError("Erro ao processar saque")
    } finally {
      setWithdrawing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a0e17" }}>
        <Loader2 className="w-8 h-8 text-[#f97316] animate-spin" />
      </div>
    )
  }

  if (!affiliate) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a0e17" }}>
        <div className="text-center px-6">
          {loadError ? (
            <>
              <p className="text-red-400 mb-4">{loadError}</p>
              <button
                onClick={() => { setLoading(true); loadData() }}
                className="px-6 py-3 rounded-xl bg-[#f97316] text-white font-medium"
              >
                Tentar novamente
              </button>
            </>
          ) : (
            <>
              <Loader2 className="w-8 h-8 text-[#f97316] animate-spin mx-auto mb-3" />
              <p className="text-white/60">Carregando painel de afiliado...</p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0e17" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[#1F2933]" style={{ backgroundColor: "#0f1419" }}>
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-white/10">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-white font-semibold">Painel de Afiliados</h1>
          <div className="w-9" />
        </div>
      </div>

      {/* Balance Card */}
      <div className="p-4">
        <div
          className="relative overflow-hidden p-5 rounded-2xl border border-[#f97316]/25"
          style={{ background: "linear-gradient(135deg, #f973161f 0%, #0a0e17 60%)" }}
        >
          {/* Malha tecnologica */}
          <div
            className="absolute inset-0 opacity-[0.18] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(249, 115, 22,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(249, 115, 22,0.4) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              maskImage: "radial-gradient(ellipse 90% 80% at 100% 0%, #000 0%, transparent 70%)",
              WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 100% 0%, #000 0%, transparent 70%)",
            }}
          />
          {/* Brilho */}
          <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-[#f97316]/25 blur-3xl pointer-events-none" />

          <div className="relative">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Saldo disponível</p>
            <p className="text-white text-3xl font-bold mb-1">
              {"R$ " + affiliate.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[#f97316]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#f97316]">
                {MODEL_LABEL[affiliate.commission_model]}
              </span>
              <p className="text-white/30 text-xs">{termsSummary(affiliate)}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-[#f97316]/15 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-[#f97316]" />
                </div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider">Cadastrados</p>
              </div>
              <p className="text-white text-xl font-bold">{affiliate.total_referrals}</p>
              <p className="text-white/30 text-[10px]">pelo seu link</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-[#26a69a]/15 flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5 text-[#26a69a]" />
                </div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider">Depositaram</p>
              </div>
              <p className="text-[#26a69a] text-xl font-bold">{affiliate.referrals_with_deposit || 0}</p>
              <p className="text-white/30 text-[10px]">{"de " + affiliate.total_referrals + " cadastrados"}</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-[#f97316]/15 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-[#f97316]" />
                </div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider">Total ganho</p>
              </div>
              <p className="text-[#f97316] text-xl font-bold">
                {"R$ " + affiliate.total_earned.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-white/30 text-[10px]">em comissões</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider">Taxa conversão</p>
              </div>
              <p className="text-amber-500 text-xl font-bold">
                {(affiliate.total_referrals > 0
                  ? Math.round(((affiliate.referrals_with_deposit || 0) / affiliate.total_referrals) * 100)
                  : 0) + "%"}
              </p>
              <p className="text-white/30 text-[10px]">cadastro para depósito</p>
            </div>
            </div>
          </div>
        </div>

        {/* Link */}
        <div className="mt-4 p-4 rounded-xl bg-[#121826] border border-[#1F2933]">
          <p className="text-white/50 text-[10px] uppercase tracking-wider mb-2">Seu link de afiliado</p>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 p-3 rounded-lg bg-[#0a0e17] border border-[#1F2933] overflow-hidden">
              <span className="text-white font-mono font-bold text-sm truncate block">
                {typeof window !== "undefined" ? window.location.origin + "/auth/sign-up?ref=" + affiliate.code : affiliate.code}
              </span>
            </div>
            <button
              onClick={copyCode}
              className="p-3 rounded-lg bg-[#f97316] hover:bg-[#f97316]/80 transition-colors flex-shrink-0"
            >
              {copied ? <Check className="w-5 h-5 text-white" /> : <Copy className="w-5 h-5 text-white" />}
            </button>
          </div>
          <button
            onClick={copyLink}
            className="w-full py-3 rounded-lg bg-[#1F2933] hover:bg-[#1F2933]/80 text-white font-medium flex items-center justify-center gap-2 text-sm"
          >
            <Share2 className="w-4 h-4" />
            Compartilhar link
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4">
        <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
          {[
            { id: "dashboard" as TabType, label: "Resumo", icon: TrendingUp },
            { id: "referrals" as TabType, label: "Indicados", icon: Users },
            { id: "operations" as TabType, label: "Operacoes", icon: Settings2 },
            { id: "withdraw" as TabType, label: "Sacar", icon: Wallet },
            { id: "history" as TabType, label: "Historico", icon: History },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors " +
                (activeTab === tab.id
                  ? "bg-[#f97316] text-white"
                  : "bg-[#121826] text-white/60 hover:text-white")
              }
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === "dashboard" && (
          <div className="space-y-4">
            <InvitesChart referrals={referrals} rangeDays={7} />

            <div className="p-4 rounded-xl bg-[#121826] border border-[#1F2933]">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#f97316]" />
                Resumo de indicados
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-[#1F2933]">
                  <span className="text-white/50 text-sm">Pessoas cadastradas</span>
                  <span className="text-white font-bold">{affiliate.total_referrals}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#1F2933]">
                  <span className="text-white/50 text-sm">Pessoas que depositaram</span>
                  <span className="text-[#26a69a] font-bold">{affiliate.referrals_with_deposit || 0}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#1F2933]">
                  <span className="text-white/50 text-sm">Modelo de comissão</span>
                  <span className="text-[#f97316] font-bold">{MODEL_LABEL[affiliate.commission_model]}</span>
                </div>
                {affiliate.commission_model !== "cpa" && (
                  <div className="flex items-center justify-between py-2 border-b border-[#1F2933]">
                    <span className="text-white/50 text-sm">RevShare por depósito</span>
                    <span className="text-[#f97316] font-bold">{affiliate.commission_rate + "%"}</span>
                  </div>
                )}
                {affiliate.commission_model !== "revshare" && (
                  <div className="flex items-center justify-between py-2 border-b border-[#1F2933]">
                    <span className="text-white/50 text-sm">
                      {"CPA por indicado (mín. " + brl(affiliate.cpa_min_deposit) + ")"}
                    </span>
                    <span className="text-[#f97316] font-bold">{brl(affiliate.cpa_amount)}</span>
                  </div>
                )}
                {affiliate.sub_percent > 0 && (
                  <div className="flex items-center justify-between py-2 border-b border-[#1F2933]">
                    <span className="text-white/50 text-sm">Sub-afiliado</span>
                    <span className="text-white font-bold">{affiliate.sub_percent + "%"}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2">
                  <span className="text-white/50 text-sm">Status</span>
                  <span className={
                    "px-2 py-0.5 rounded-md text-xs font-bold " +
                    (affiliate.status === "active" ? "bg-[#26a69a]/15 text-[#26a69a]" : "bg-red-500/15 text-red-400")
                  }>
                    {affiliate.status === "active" ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#121826] border border-[#1F2933]">
              <h3 className="text-white font-semibold mb-3">Como funciona</h3>
              <div className="space-y-3">
                {[
                  "Compartilhe seu codigo ou link de convite",
                  "Seu amigo se cadastra usando seu codigo",
                  "Sua comissão: " + termsSummary(affiliate),
                  "Saque suas comissões via PIX quando quiser (mínimo " + brl(affiliate.min_withdrawal) + ")",
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#f97316]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#f97316] text-xs font-bold">{i + 1}</span>
                    </div>
                    <p className="text-white/60 text-sm">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "referrals" && (
          <div className="space-y-3">
            {referrals.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#121826] border border-[#1F2933] text-center">
                <Users className="w-12 h-12 text-[#374151] mx-auto mb-3" />
                <p className="text-white/60">Nenhum indicado ainda</p>
                <p className="text-white/40 text-sm mt-1">Compartilhe seu codigo para comecar a ganhar!</p>
              </div>
            ) : (
              referrals.map((referral) => (
                <div key={referral.id} className="p-4 rounded-xl bg-[#121826] border border-[#1F2933]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#f97316]/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-[#f97316]" />
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {referral.profiles?.full_name || "Usuario"}
                        </p>
                        <p className="text-white/40 text-xs">
                          {new Date(referral.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <span
                      className={
                        "px-2 py-1 rounded-lg text-xs font-medium " +
                        (referral.status === "active"
                          ? "bg-[#f97316]/20 text-[#f97316]"
                          : "bg-yellow-500/20 text-yellow-500")
                      }
                    >
                      {referral.status === "active" ? "Ativo" : "Registrado"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-[#1F2933]">
                    <div>
                      <p className="text-white/40 text-xs">Depositos</p>
                      <p className="text-white font-medium">
                        {"R$ " + referral.total_deposits.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs">Sua comissao</p>
                      <p className="text-[#f97316] font-medium">
                        {"R$ " + referral.total_commission.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "operations" && <AffiliateTradeEditor />}

        {activeTab === "withdraw" && (
          <div className="space-y-4">
            {withdrawSuccess && (
              <div className="p-4 rounded-xl bg-[#f97316]/20 border border-[#f97316]/30">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-[#f97316]" />
                  <p className="text-[#f97316] font-medium">Saque solicitado com sucesso!</p>
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl bg-[#121826] border border-[#1F2933]">
              <label className="text-white/60 text-xs mb-2 block">Valor do saque</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">R$</span>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full p-4 pl-12 rounded-xl bg-[#0a0e17] border border-[#1F2933] text-white text-lg font-bold focus:border-[#f97316] outline-none"
                />
              </div>
              <p className="text-white/40 text-xs mt-2">
                {"Mínimo: " + brl(affiliate.min_withdrawal) + " | Disponível: " + brl(affiliate.balance)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#121826] border border-[#1F2933]">
              <label className="text-white/60 text-xs mb-2 block">Tipo de chave PIX</label>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { value: "cpf", label: "CPF" },
                  { value: "email", label: "E-mail" },
                  { value: "phone", label: "Telefone" },
                  { value: "random", label: "Aleatoria" },
                ].map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setPixKeyType(type.value)}
                    className={
                      "p-2 rounded-lg text-xs font-medium transition-colors " +
                      (pixKeyType === type.value
                        ? "bg-[#f97316] text-white"
                        : "bg-[#0a0e17] text-white/60 hover:text-white")
                    }
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              <label className="text-white/60 text-xs mb-2 block">Chave PIX</label>
              <input
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder={
                  pixKeyType === "cpf" ? "000.000.000-00" :
                  pixKeyType === "email" ? "seu@email.com" :
                  pixKeyType === "phone" ? "(00) 00000-0000" : "Chave aleatoria"
                }
                className="w-full p-4 rounded-xl bg-[#0a0e17] border border-[#1F2933] text-white focus:border-[#f97316] outline-none"
              />
            </div>

            {Number.parseFloat(withdrawAmount) > 0 && (
              <div className="p-4 rounded-xl bg-[#121826] border border-[#1F2933] space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Valor solicitado</span>
                  <span className="text-white">{brl(Number.parseFloat(withdrawAmount))}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">
                    {"Taxa de saque (" + affiliate.withdrawal_fee_percent + "%)"}
                  </span>
                  <span className="text-red-400">
                    {"- " + brl((Number.parseFloat(withdrawAmount) * affiliate.withdrawal_fee_percent) / 100)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#1F2933]">
                  <span className="text-white/80 font-medium">Você recebe</span>
                  <span className="text-[#00E676] font-bold">
                    {brl(
                      Number.parseFloat(withdrawAmount) *
                        (1 - affiliate.withdrawal_fee_percent / 100),
                    )}
                  </span>
                </div>
              </div>
            )}

            {withdrawError && (
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30">
                <p className="text-red-400 text-sm">{withdrawError}</p>
              </div>
            )}

            <button
              onClick={handleWithdraw}
              disabled={withdrawing || !withdrawAmount || !pixKey}
              className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #f97316 0%, #fb923c 100%)" }}
            >
              {withdrawing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ArrowUpRight className="w-5 h-5" />
                  Solicitar Saque
                </>
              )}
            </button>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-3">
            {withdrawals.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#121826] border border-[#1F2933] text-center">
                <History className="w-12 h-12 text-[#374151] mx-auto mb-3" />
                <p className="text-white/60">Nenhum saque realizado</p>
              </div>
            ) : (
              withdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="p-4 rounded-xl bg-[#121826] border border-[#1F2933]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {withdrawal.status === "pending" ? (
                        <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-yellow-500" />
                        </div>
                      ) : withdrawal.status === "completed" || withdrawal.status === "approved" ? (
                        <div className="w-10 h-10 rounded-full bg-[#f97316]/20 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-[#f97316]" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                          <XCircle className="w-5 h-5 text-red-500" />
                        </div>
                      )}
                      <div>
                        <p className="text-white font-bold">
                          {"R$ " + withdrawal.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-white/40 text-xs">
                          {new Date(withdrawal.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <span
                      className={
                        "px-2 py-1 rounded-lg text-xs font-medium " +
                        (withdrawal.status === "pending"
                          ? "bg-yellow-500/20 text-yellow-500"
                          : withdrawal.status === "completed" || withdrawal.status === "approved"
                            ? "bg-[#f97316]/20 text-[#f97316]"
                            : "bg-red-500/20 text-red-500")
                      }
                    >
                      {withdrawal.status === "pending" ? "Pendente" : withdrawal.status === "completed" || withdrawal.status === "approved" ? "Aprovado" : "Rejeitado"}
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#1F2933] space-y-1">
                    {withdrawal.net_amount != null && (
                      <p className="text-white/40 text-xs">
                        {withdrawal.fee != null
                          ? "Líquido recebido (taxa " + brl(withdrawal.fee) + "): "
                          : "Líquido recebido: "}
                        <span className="text-[#00E676]">{brl(withdrawal.net_amount)}</span>
                      </p>
                    )}
                    <p className="text-white/40 text-xs">
                      {"PIX: "}
                      <span className="text-white/60">{withdrawal.pix_key}</span>
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Animacao de "sacando" exibida antes do pop-up */}
      {processingAnim && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative flex h-24 w-24 items-center justify-center">
            {/* aneis pulsantes */}
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f97316]/20" />
            <span className="absolute inline-flex h-16 w-16 animate-ping rounded-full bg-[#f97316]/30 [animation-delay:200ms]" />
            {/* anel giratorio */}
            <span className="absolute h-24 w-24 rounded-full border-4 border-[#f97316]/20 border-t-[#f97316] animate-spin" />
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f97316]/15 ring-1 ring-[#f97316]/40">
              <Wallet className="h-7 w-7 text-[#f97316]" />
            </div>
          </div>
          <p className="mt-6 text-white font-semibold text-lg">Sacando...</p>
          <p className="mt-1 text-white/50 text-sm">Processando sua solicitação</p>
        </div>
      )}

      {/* Pop-up de confirmacao de saque */}
      {confirmation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmation(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#1F2933] bg-[#121826] p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f97316]/15 ring-1 ring-[#f97316]/30">
              <Clock className="h-7 w-7 text-[#f97316]" />
            </div>
            <h3 className="text-white text-lg font-semibold mb-2">Saque em processamento</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Sua solicitação de saque foi recebida e está sendo processada pela empresa intermediadora de
              pagamento. O valor será creditado automaticamente em até{" "}
              <span className="text-white font-medium">72 horas úteis</span> na chave PIX informada nesta
              solicitação.
            </p>

            <div className="mt-5 space-y-2 rounded-xl border border-[#1F2933] bg-[#0a0e17] p-4 text-left">
              <div className="flex items-center justify-between">
                <span className="text-white/50 text-sm">Valor a receber</span>
                <span className="text-[#f97316] font-semibold">
                  {"R$ " +
                    confirmation.netAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/50 text-sm shrink-0">Chave PIX</span>
                <span className="text-white/80 text-sm truncate">{confirmation.pixKey}</span>
              </div>
            </div>

            <p className="mt-4 text-white/40 text-xs">
              Em caso de dúvidas, entre em contato com o nosso suporte.
            </p>

            <button
              type="button"
              onClick={() => setConfirmation(null)}
              className="mt-5 w-full rounded-xl bg-[#f97316] py-3 font-semibold text-white transition-colors hover:bg-[#c2410c]"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

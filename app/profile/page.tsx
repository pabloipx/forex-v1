"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
  ChevronRight,
  Wallet,
  History,
  User,
  LogOut,
  ChevronLeft,
  DollarSign,
  HandCoins,
  Banknote,
  Settings,
  HelpCircle,
  Users,
  BadgeCheck,
  TrendingUp,
  TrendingDown,
  Target,
  Trophy,
  Award,
  Lock,
  Check,
  Bot,
  Power,
  ShieldCheck,
} from "lucide-react"
import { computeRank, RANKS, type RankProgress } from "@/lib/ranks"
import { KaykoActivateModal } from "@/components/trading/kayko-activate-modal"

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  is_verified: boolean
}

interface UserBalance {
  balance_real: number
  balance_demo: number
}

interface TradeStats {
  total_trades: number
  wins: number
  losses: number
  total_profit: number
}

interface RecentWithdrawal {
  id: string
  amount: number
  method: string | null
  status: string
  pix_key: string | null
  created_at: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [balance, setBalance] = useState<UserBalance>({ balance_real: 0, balance_demo: 1000 })
  const [stats, setStats] = useState<TradeStats>({ total_trades: 0, wins: 0, losses: 0, total_profit: 0 })
  const [recentWithdrawals, setRecentWithdrawals] = useState<RecentWithdrawal[]>([])
  const [rank, setRank] = useState<RankProgress>(() => computeRank(0, 0))
  const [loading, setLoading] = useState(true)
  const [kaykoActive, setKaykoActive] = useState(false)
  const [showKaykoModal, setShowKaykoModal] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    try {
      setKaykoActive(localStorage.getItem("kayko_robot_active") === "1")
    } catch {
      setKaykoActive(false)
    }
  }, [])

  const setKayko = (active: boolean) => {
    try {
      if (active) {
        localStorage.setItem("kayko_robot_active", "1")
        // Ao ativar, o placar começa zerado (0 x 0). Ele só sobe pelo resultado
        // real das entradas feitas na tela de trade.
        localStorage.setItem("kayko_score_v1", JSON.stringify({ win: 0, loss: 0, profit: 0 }))
        // Marca o instante da ativação: só contam no placar as entradas abertas a
        // partir daqui — entradas que já estavam abertas antes de ativar são ignoradas.
        localStorage.setItem("kayko_activated_at", String(Date.now()))
      } else {
        localStorage.removeItem("kayko_robot_active")
      }
      // Notifica a tela de trade (mesma aba) para refletir na hora.
      window.dispatchEvent(new Event("kayko:changed"))
    } catch {
      // ignora
    }
    setKaykoActive(active)
  }

  // Painel admin: editar manualmente o placar do robô flutuante.
  // Visível apenas para a conta admin (admin@admin.com).
  const isAdmin = profile?.email?.toLowerCase() === "admin@admin.com"
  const [adminScore, setAdminScore] = useState({ win: "", loss: "", profit: "" })
  const [adminSaved, setAdminSaved] = useState(false)

  // Ao virar admin (perfil carregado), pré-carrega os campos com o placar salvo.
  useEffect(() => {
    if (!isAdmin) return
    try {
      const raw = localStorage.getItem("kayko_score_v1")
      if (raw) {
        const p = JSON.parse(raw)
        setAdminScore({
          win: String(p.win ?? 0),
          loss: String(p.loss ?? 0),
          profit: String(p.profit ?? 0),
        })
      }
    } catch {
      // ignora
    }
  }, [isAdmin])

  const saveAdminScore = () => {
    try {
      // O placar do robô fica atrelado ao carimbo de ativação. Garante que existe um,
      // para que o valor definido pelo admin seja respeitado pelo flutuante.
      let activatedAt = Number(localStorage.getItem("kayko_activated_at")) || 0
      if (activatedAt === 0) {
        activatedAt = Date.now()
        localStorage.setItem("kayko_activated_at", String(activatedAt))
      }
      const next = {
        win: Math.max(0, Math.floor(Number(adminScore.win) || 0)),
        loss: Math.max(0, Math.floor(Number(adminScore.loss) || 0)),
        profit: Math.round((Number(adminScore.profit) || 0) * 100) / 100,
      }
      localStorage.setItem("kayko_score_v1", JSON.stringify({ ...next, for: activatedAt }))
      // Atualiza o flutuante ao vivo caso esteja montado (mesma aba).
      window.dispatchEvent(new CustomEvent("kayko:score-set", { detail: next }))
      setAdminScore({ win: String(next.win), loss: String(next.loss), profit: String(next.profit) })
      setAdminSaved(true)
      setTimeout(() => setAdminSaved(false), 1500)
    } catch {
      // ignora
    }
  }

  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          if (isMounted) router.replace("/auth/login")
          return
        }

        const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single()

        if (isMounted && profileData) {
          setProfile(profileData)
        }

        const { data: balanceData } = await supabase
          .from("user_balances")
          .select("balance_real, balance_demo")
          .eq("user_id", user.id)
          .single()

        if (isMounted && balanceData) {
          setBalance(balanceData)
        }

        // Load trade stats (real account only)
        const { data: tradesData } = await supabase
          .from("trades")
          .select("result, profit")
          .eq("user_id", user.id)
          .eq("is_demo", false)
          .not("result", "is", null)

        if (isMounted && tradesData) {
          const wins = tradesData.filter((t) => t.result === "win" || t.result === "WIN").length
          const losses = tradesData.filter((t) => t.result === "loss" || t.result === "LOSS").length
          const total_profit = tradesData.reduce((sum, t) => sum + (t.profit || 0), 0)
          setStats({
            total_trades: tradesData.length,
            wins,
            losses,
            total_profit,
          })
        }

        // --- RANK: total depositado (acumulado) + total de entradas reais ---
        // Total depositado: soma de todos os depositos aprovados/concluidos.
        const { data: depositsData } = await supabase
          .from("deposits")
          .select("amount, status")
          .eq("user_id", user.id)
          .in("status", ["approved", "completed"])

        const totalDeposited = (depositsData || []).reduce((sum, d) => sum + Number(d.amount || 0), 0)

        // Total de entradas reais: todas as operacoes da conta real (independente do resultado).
        const { count: entriesCount } = await supabase
          .from("trades")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_demo", false)

        if (isMounted) {
          setRank(computeRank(totalDeposited, entriesCount || 0))
        }

        // Load recent withdrawals (last 5)
        const { data: withdrawalData } = await supabase
          .from("withdrawals")
          .select("id, amount, method, status, pix_key, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5)

        if (isMounted && withdrawalData) {
          setRecentWithdrawals(withdrawalData as RecentWithdrawal[])
        }

        if (isMounted) setLoading(false)
      } catch (error) {
        console.error("[v0] Profile error loading:", error)
        if (isMounted) setLoading(false)
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace("/auth/login")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0B0F14" }}>
        <div className="w-8 h-8 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const winRate = stats.total_trades > 0 ? ((stats.wins / stats.total_trades) * 100).toFixed(0) : "0"
  const initials = (profile?.full_name || profile?.email || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const formatRelative = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  }

  const getStatusInfo = (status: string) => {
    const s = status?.toLowerCase()
    if (s === "completed" || s === "approved" || s === "paid")
      return { label: "Concluído", color: "#22c55e", bg: "rgba(34,197,94,0.15)" }
    if (s === "rejected" || s === "cancelled" || s === "canceled")
      return { label: "Recusado", color: "#EF4444", bg: "rgba(239,68,68,0.15)" }
    return { label: "Pendente", color: "#F59E0B", bg: "rgba(245,158,11,0.15)" }
  }

  const methodLabel = (method: string | null) => {
    const m = method?.toLowerCase()
    if (m === "crypto") return "Cripto"
    if (m === "pix" || !m) return "Pix"
    return method as string
  }

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#0B0F14" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 py-4 flex items-center gap-3 border-b border-[#1F2933]/60 backdrop-blur-md bg-[#0B0F14]/80">
        <button onClick={() => router.back()} className="p-2 -ml-2 active:opacity-70" aria-label="Voltar">
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-xl font-bold text-white">Perfil</h1>
      </div>

      {/* Hero / User card */}
      <div className="px-4 pt-6">
        <div
          className="relative overflow-hidden rounded-2xl border border-[#f97316]/20 p-6"
          style={{ background: "linear-gradient(135deg, #f9731622 0%, #121826 60%)" }}
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full flex items-center justify-center border-2 border-[#f97316]/40 bg-[#0B0F14] overflow-hidden">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url || "/placeholder.svg"}
                    alt="Avatar"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-[#f97316]">{initials}</span>
                )}
              </div>
              {profile?.is_verified && (
                <span className="absolute -bottom-1 -right-1 rounded-full bg-[#0B0F14] p-0.5">
                  <BadgeCheck className="w-6 h-6 text-[#f97316]" fill="#f97316" stroke="#0B0F14" />
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">{profile?.full_name || "Usuário"}</h2>
              <p className="text-[#9CA3AF] text-sm truncate">{profile?.email}</p>
              <span
                className={`inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-medium ${
                  profile?.is_verified
                    ? "bg-[#f97316]/20 text-[#fdba74]"
                    : "bg-[#374151]/40 text-[#9CA3AF]"
                }`}
              >
                <BadgeCheck className="w-3.5 h-3.5" />
                {profile?.is_verified ? "Conta verificada" : "Não verificada"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Rank / Nivel */}
      <div className="px-4 pt-5">
        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: "#121826", borderColor: `${rank.current.color}40` }}
        >
          {/* Cabecalho do rank atual */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${rank.current.color}22` }}
              >
                <Award className="w-6 h-6" style={{ color: rank.current.color }} />
              </div>
              <div>
                <p className="text-[10px] text-[#6B7280] uppercase tracking-wide">Seu rank</p>
                <p className="text-lg font-bold" style={{ color: rank.current.color }}>
                  {rank.current.name}
                </p>
              </div>
            </div>
            {rank.next ? (
              <div className="text-right">
                <p className="text-[10px] text-[#6B7280] uppercase tracking-wide">Próximo</p>
                <p className="text-sm font-semibold" style={{ color: rank.next.color }}>
                  {rank.next.name}
                </p>
              </div>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ color: rank.current.color, backgroundColor: `${rank.current.color}22` }}>
                Nível máximo
              </span>
            )}
          </div>

          {/* Escada de ranks */}
          <div className="flex items-center gap-1.5 mb-5">
            {RANKS.map((r) => {
              const achieved = rank.current.id >= r.id
              return (
                <div key={r.id} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className="w-full h-1.5 rounded-full"
                    style={{ backgroundColor: achieved ? r.color : "#1F2933" }}
                  />
                  <span
                    className="text-[9px] font-medium"
                    style={{ color: achieved ? r.color : "#4B5563" }}
                  >
                    {r.name}
                  </span>
                </div>
              )
            })}
          </div>

          {rank.next ? (
            <>
              {/* Meta de deposito */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    <span className="text-xs text-[#9CA3AF]">Depósito acumulado</span>
                  </div>
                  <span className="text-xs font-semibold text-white">
                    R$ {formatCurrency(rank.totalDeposited)} / R$ {formatCurrency(rank.next.minDeposit)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#0B0F14] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${rank.depositPct}%`, backgroundColor: rank.next.color }}
                  />
                </div>
              </div>

              {/* Meta de entradas */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    <span className="text-xs text-[#9CA3AF]">Entradas realizadas</span>
                  </div>
                  <span className="text-xs font-semibold text-white">
                    {rank.totalEntries} / {rank.next.minEntries}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#0B0F14] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${rank.entriesPct}%`, backgroundColor: rank.next.color }}
                  />
                </div>
              </div>

              {/* Resumo do que falta */}
              <div className="flex items-center gap-2 rounded-xl p-3" style={{ backgroundColor: "#0B0F14" }}>
                <Lock className="w-4 h-4 shrink-0" style={{ color: rank.next.color }} />
                <p className="text-xs text-[#9CA3AF]">
                  Para alcançar <span className="font-semibold" style={{ color: rank.next.color }}>{rank.next.name}</span>
                  {rank.depositRemaining > 0 && (
                    <> deposite mais <span className="font-semibold text-white">R$ {formatCurrency(rank.depositRemaining)}</span></>
                  )}
                  {rank.depositRemaining > 0 && rank.entriesRemaining > 0 && " e"}
                  {rank.entriesRemaining > 0 && (
                    <> faça mais <span className="font-semibold text-white">{rank.entriesRemaining}</span> {rank.entriesRemaining === 1 ? "entrada" : "entradas"}</>
                  )}
                  .
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 rounded-xl p-3" style={{ backgroundColor: "#0B0F14" }}>
              <Check className="w-4 h-4 shrink-0" style={{ color: rank.current.color }} />
              <p className="text-xs text-[#9CA3AF]">
                Parabéns! Você atingiu o rank máximo com R$ {formatCurrency(rank.totalDeposited)} depositados e {rank.totalEntries} entradas.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Performance Stats */}
      <div className="px-4 pt-5">
        <div className="rounded-2xl border border-[#1F2933] p-5" style={{ backgroundColor: "#121826" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#f97316]" />
              <span className="text-sm font-semibold text-white">Desempenho (conta real)</span>
            </div>
            <span className="text-xs text-[#6B7280]">{stats.total_trades} operações</span>
          </div>

          {/* Win rate bar */}
          <div className="mb-5">
            <div className="flex items-end justify-between mb-2">
              <span className="text-xs text-[#9CA3AF]">Taxa de acerto</span>
              <span className="text-2xl font-bold text-white">{winRate}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-[#0B0F14] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${winRate}%`,
                  background: "linear-gradient(90deg, #f97316, #fdba74)",
                }}
              />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "#0B0F14" }}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-[#22c55e]" />
                <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">Vitórias</span>
              </div>
              <p className="text-lg font-bold text-[#22c55e]">{stats.wins}</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "#0B0F14" }}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingDown className="w-3.5 h-3.5 text-[#EF4444]" />
                <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">Derrotas</span>
              </div>
              <p className="text-lg font-bold text-[#EF4444]">{stats.losses}</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "#0B0F14" }}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Target className="w-3.5 h-3.5 text-[#f97316]" />
                <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">Lucro</span>
              </div>
              <p className={`text-lg font-bold ${stats.total_profit >= 0 ? "text-[#22c55e]" : "text-[#EF4444]"}`}>
                {stats.total_profit >= 0 ? "+" : ""}
                {formatCurrency(stats.total_profit)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="px-4 pt-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl border border-[#1F2933]" style={{ backgroundColor: "#121826" }}>
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-[#f97316]" />
              <span className="text-xs text-[#9CA3AF]">Saldo Real</span>
            </div>
            <p className="text-xl font-bold text-white">R$ {formatCurrency(balance.balance_real)}</p>
          </div>
          <div className="p-4 rounded-2xl border border-[#1F2933]" style={{ backgroundColor: "#121826" }}>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-[#9CA3AF]" />
              <span className="text-xs text-[#9CA3AF]">Saldo Demo</span>
            </div>
            <p className="text-xl font-bold text-[#9CA3AF]">R$ {formatCurrency(balance.balance_demo)}</p>
          </div>
        </div>
      </div>

      {/* Withdrawal History */}
      <div className="px-4 pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HandCoins className="w-4 h-4 text-[#f97316]" />
            <h3 className="text-base font-semibold text-white">Histórico de saques</h3>
          </div>
          <Link href="/transactions" className="flex items-center gap-1 text-xs font-medium text-[#fdba74] active:opacity-70">
            Ver tudo
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {recentWithdrawals.length === 0 ? (
          <div
            className="rounded-2xl border border-[#1F2933] p-8 text-center"
            style={{ backgroundColor: "#121826" }}
          >
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[#0B0F14] flex items-center justify-center">
              <HandCoins className="w-7 h-7 text-[#4B5563]" />
            </div>
            <p className="text-[#9CA3AF] text-sm">Nenhum saque ainda</p>
            <Link href="/withdraw" className="mt-3 inline-block text-sm font-medium text-[#fdba74] active:opacity-70">
              Solicitar saque
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentWithdrawals.map((withdrawal) => {
              const statusInfo = getStatusInfo(withdrawal.status)

              return (
                <div
                  key={withdrawal.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[#1F2933]"
                  style={{ backgroundColor: "#121826" }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#f97316]/15">
                    <HandCoins className="w-5 h-5 text-[#f97316]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">Saque</span>
                      <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-[#374151] text-[#9CA3AF] rounded uppercase">
                        {methodLabel(withdrawal.method)}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280]">{formatRelative(withdrawal.created_at)}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-white">- R$ {formatCurrency(withdrawal.amount)}</p>
                    <span
                      className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-semibold rounded-lg"
                      style={{ color: statusInfo.color, backgroundColor: statusInfo.bg }}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Robô KAYKO */}
      <div className="px-4 pt-6">
        <button
          onClick={() => (kaykoActive ? setKayko(false) : setShowKaykoModal(true))}
          className="w-full text-left p-5 rounded-2xl border active:scale-[0.99] transition-transform"
          style={{
            borderColor: kaykoActive ? "#22d3ee55" : "#1F2933",
            background: kaykoActive
              ? "linear-gradient(135deg, #22d3ee18 0%, #121826 100%)"
              : "#121826",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#22d3ee1f", boxShadow: kaykoActive ? "0 0 16px #22d3ee55" : "none" }}
              >
                <img src="/images/kayko-robot.png" alt="Robô KAYKO" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">
                    Robô <span style={{ color: "#22d3ee" }}>KAYKO</span>
                  </h3>
                  <Bot className="w-4 h-4" style={{ color: "#22d3ee" }} />
                </div>
                <p className="text-[#6B7280] text-xs truncate">
                  {kaykoActive ? "Ativo na tela de trade" : "Analisa o ativo e mostra a entrada"}
                </p>
              </div>
            </div>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0"
              style={{
                color: kaykoActive ? "#04121a" : "#22d3ee",
                backgroundColor: kaykoActive ? "#22d3ee" : "#22d3ee1f",
              }}
            >
              <Power className="w-3.5 h-3.5" />
              {kaykoActive ? "Ativado" : "Ativar"}
            </span>
          </div>
        </button>
      </div>

      {/* Admin: editar placar do flutuante (apenas admin@admin.com) */}
      {isAdmin && (
        <div className="px-4 pt-4">
          <div
            className="p-5 rounded-2xl border"
            style={{ borderColor: "#f9731633", background: "linear-gradient(135deg, #f9731612 0%, #121826 100%)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-[#f97316]" />
              <h3 className="text-base font-bold text-white">Editar placar do flutuante</h3>
            </div>
            <p className="text-[#6B7280] text-xs mb-4">Somente admin. Define o resultado exibido no robô KAYKO.</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: "#22c55e" }}>
                  WIN
                </label>
                <input
                  inputMode="numeric"
                  value={adminScore.win}
                  onChange={(e) => setAdminScore((s) => ({ ...s, win: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#0b111c] border border-[#1F2933] text-white text-sm outline-none focus:border-[#22c55e]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: "#ef4444" }}>
                  LOSS
                </label>
                <input
                  inputMode="numeric"
                  value={adminScore.loss}
                  onChange={(e) => setAdminScore((s) => ({ ...s, loss: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#0b111c] border border-[#1F2933] text-white text-sm outline-none focus:border-[#ef4444]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1 text-[#9CA3AF]">R$</label>
                <input
                  inputMode="decimal"
                  value={adminScore.profit}
                  onChange={(e) => setAdminScore((s) => ({ ...s, profit: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#0b111c] border border-[#1F2933] text-white text-sm outline-none focus:border-[#f97316]"
                />
              </div>
            </div>
            <button
              onClick={saveAdminScore}
              className="mt-4 w-full py-3 rounded-xl font-bold text-sm active:scale-[0.99] transition-transform"
              style={{ backgroundColor: "#f97316", color: "#0b111c" }}
            >
              {adminSaved ? "Placar atualizado!" : "Salvar placar"}
            </button>
          </div>
        </div>
      )}

      {/* Action Cards */}
      <div className="px-4 pt-6 space-y-3">
        {/* Deposit */}
        <Link href="/deposit" className="block">
          <div className="p-5 rounded-2xl border border-[#1F2933] active:scale-[0.99] transition-transform" style={{ backgroundColor: "#121826" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#f97316]/15 flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-[#f97316]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Depósito</h3>
                  <p className="text-[#6B7280] text-xs">Adicione fundos à sua conta</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#6B7280]" />
            </div>
          </div>
        </Link>

        {/* Withdraw */}
        <Link href="/withdraw" className="block">
          <div className="p-5 rounded-2xl border border-[#1F2933] active:scale-[0.99] transition-transform" style={{ backgroundColor: "#121826" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#1F2933] flex items-center justify-center">
                  <HandCoins className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Saque</h3>
                  <p className="text-[#6B7280] text-xs">Solicite um saque da sua conta</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#6B7280]" />
            </div>
          </div>
        </Link>

        {/* Invite */}
        <Link href="/afiliados" className="block">
          <div
            className="p-5 rounded-2xl border border-[#f97316]/30 active:scale-[0.99] transition-transform"
            style={{ background: "linear-gradient(135deg, #f9731618 0%, #121826 100%)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#f97316]/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#f97316]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Convide amigos</h3>
                  <p className="text-[#6B7280] text-xs">Indique e ganhe comissões!</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#f97316]" />
            </div>
          </div>
        </Link>
      </div>

      {/* Menu Options */}
      <div className="px-4 pt-6 space-y-2">
        <Link href="/transactions" className="block">
          <div className="p-4 rounded-xl flex items-center justify-between border border-[#1F2933]" style={{ backgroundColor: "#121826" }}>
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-[#9CA3AF]" />
              <span className="text-white">Transações</span>
            </div>
            <ChevronRight className="w-5 h-5 text-[#6B7280]" />
          </div>
        </Link>

        <Link href="/settings" className="block">
          <div className="p-4 rounded-xl flex items-center justify-between border border-[#1F2933]" style={{ backgroundColor: "#121826" }}>
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-[#9CA3AF]" />
              <span className="text-white">Configurações</span>
            </div>
            <ChevronRight className="w-5 h-5 text-[#6B7280]" />
          </div>
        </Link>

        <Link href="/suporte" className="block">
          <div className="p-4 rounded-xl flex items-center justify-between border border-[#1F2933]" style={{ backgroundColor: "#121826" }}>
            <div className="flex items-center gap-3">
              <HelpCircle className="w-5 h-5 text-[#9CA3AF]" />
              <span className="text-white">Ajuda</span>
            </div>
            <ChevronRight className="w-5 h-5 text-[#6B7280]" />
          </div>
        </Link>

        <button
          onClick={handleLogout}
          className="w-full p-4 rounded-xl flex items-center gap-3 border border-[#EF4444]/20"
          style={{ backgroundColor: "#121826" }}
        >
          <LogOut className="w-5 h-5 text-[#EF4444]" />
          <span className="text-[#EF4444]">Sair da conta</span>
        </button>
      </div>

      <KaykoActivateModal
        isOpen={showKaykoModal}
        onClose={() => setShowKaykoModal(false)}
        onActivated={() => setKayko(true)}
      />
    </div>
  )
}

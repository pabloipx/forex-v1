"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  LogOut,
  Home,
  Menu,
  X,
  Search,
  Edit,
  Check,
  CreditCard,
  Banknote,
  ShieldCheck,
  History,
  Eye,
  UserPlus,
  Settings,
  CandlestickChart,
  Zap,
  Gift,
  Repeat,
  Bot,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { TradeEditor } from "@/components/admin/trade-editor"
import { AdminAffiliates } from "@/components/admin/sections/admin-affiliates"
import { AdminCards } from "@/components/admin/sections/admin-cards"
import { AdminCharts } from "@/components/admin/sections/admin-charts"
import { UsersChart, DepositsChart } from "@/components/admin/sections/tab-charts"
import { AdminAssets } from "@/components/admin/sections/admin-assets"
import { AdminManipulation } from "@/components/admin/sections/admin-manipulation"
import { AdminPromotions } from "@/components/admin/sections/admin-promotions"

// A autorizacao do painel e feita por cookie HttpOnly assinado, enviado automaticamente
// pelo navegador em requisicoes same-origin. Nenhum segredo trafega pelo bundle.
const ADMIN_TOKEN = ""

interface Stats {
  totalUsers: number
  totalDeposited: number
  totalWithdrawn: number
  totalTrades: number
  platformProfit: number
  pendingDeposits: number
  pendingWithdrawals: number
  totalBalanceReal: number
  pendingKyc: number
}

interface User {
  id: string
  email: string
  full_name: string
  phone: string
  is_blocked: boolean
  is_verified: boolean
  created_at: string
  balance_real: number
  balance_demo: number
  rollover?: { required: number; progress: number; remaining: number; count: number } | null
}

interface Deposit {
  id: string
  user_id: string
  amount: number
  status: string
  created_at: string
  user_name?: string
  user_email?: string
}

interface Withdrawal {
  id: string
  user_id: string
  amount: number
  status: string
  payment_details: any
  created_at: string
  user_name?: string
  user_email?: string
}

interface KycRequest {
  id: string
  user_id: string
  document_front_url: string
  document_back_url: string
  selfie_with_document_url: string
  status: string
  rejection_reason?: string
  created_at: string
  user_name?: string
  user_email?: string
}

export default function AdminDashboardClient() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeTab, setActiveTab] = useState<"home" | "users" | "deposits" | "withdrawals" | "kyc" | "trades" | "affiliates" | "promotions" | "cards" | "assets" | "manipulation" | "robo_ia" | "settings">("home")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Stats - initialize with default values to prevent null errors
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
    totalTrades: 0,
    platformProfit: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    totalBalanceReal: 0,
    pendingKyc: 0,
  })
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsRefreshKey, setStatsRefreshKey] = useState(0)

  // Users
  const [users, setUsers] = useState<any[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [userDaysFilter, setUserDaysFilter] = useState<number | "all">("all")

  // Robo IA
  const [iaUsers, setIaUsers] = useState<any[]>([])
  const [iaMetaDraft, setIaMetaDraft] = useState<Record<string, string>>({})
  const [iaMetaSavingId, setIaMetaSavingId] = useState<string | null>(null)
  const [iaEarningSavingId, setIaEarningSavingId] = useState<string | null>(null)
  const [iaPauseSavingId, setIaPauseSavingId] = useState<string | null>(null)
  const [iaCreditDraft, setIaCreditDraft] = useState<Record<string, string>>({})
  const [iaCreditSavingId, setIaCreditSavingId] = useState<string | null>(null)
  const [iaLossSavingId, setIaLossSavingId] = useState<string | null>(null)
  const [iaLoading, setIaLoading] = useState(false)
  const [iaSavingId, setIaSavingId] = useState<string | null>(null)
  const [iaDraft, setIaDraft] = useState<Record<string, string>>({})
  const [iaSuccess, setIaSuccess] = useState<string | null>(null)
  const [iaDetail, setIaDetail] = useState<any | null>(null)
  const [iaDetailLoading, setIaDetailLoading] = useState(false)

  // Deposits
  const [deposits, setDeposits] = useState<any[]>([])
  const [depositsLoading, setDepositsLoading] = useState(false)

  // Withdrawals
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false)

  const [kycRequests, setKycRequests] = useState<any[]>([])
  const [kycLoading, setKycLoading] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectingKyc, setRejectingKyc] = useState<string | null>(null)
  const [processingKycId, setProcessingKycId] = useState<string | null>(null)
  const [kycSuccess, setKycSuccess] = useState<string | null>(null)

  // Rollover modal
  const [rolloverUser, setRolloverUser] = useState<any>(null)
  const [rolloverForm, setRolloverForm] = useState({ baseAmount: 0, multiplier: 1 })
  const [rolloverSaving, setRolloverSaving] = useState(false)
  const [rolloverSuccess, setRolloverSuccess] = useState<string | null>(null)

  // Edit modal
  const [editingUser, setEditingUser] = useState<any>(null)
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    balance_real: 0,
    balance_demo: 0,
    is_blocked: false,
    is_verified: false,
    is_affiliate: false,
  })
  const [saving, setSaving] = useState(false)

  // Error state
  const [error, setError] = useState("")

  // Settings state
  const [cardDepositEnabled, setCardDepositEnabled] = useState(true)
  const [cryptoDepositEnabled, setCryptoDepositEnabled] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(false)

  // Rollover de deposito e prazo de saque. Guardados como texto para nao atrapalhar a digitacao
  // (um campo numerico controlado nao deixa apagar o ultimo digito nem escrever "1,").
  const [depositRolloverEnabled, setDepositRolloverEnabled] = useState(false)
  const [depositRolloverMultiplier, setDepositRolloverMultiplier] = useState("1")
  const [withdrawalHours, setWithdrawalHours] = useState("72")
  const [savingRollover, setSavingRollover] = useState(false)
  const [rolloverMsg, setRolloverMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [imageModal, setImageModal] = useState<{ open: boolean; url: string; title: string }>({
    open: false,
    url: "",
    title: "",
  })
  const [loading, setLoading] = useState(false) // Added to disable buttons during KYC actions
  const adminToken = ADMIN_TOKEN // Use a const for clarity

  useEffect(() => {
    // A sessao e confirmada no servidor, que le o cookie HttpOnly assinado. O
    // sessionStorage nao serve como prova de acesso: ele e gravavel pelo proprio
    // visitante e nao tem qualquer efeito sobre as rotas /api/admin.
    let active = true

    fetch("/api/admin/session")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return
        if (data?.authenticated) {
          setIsAuthenticated(true)
        } else {
          sessionStorage.removeItem("admin_authenticated")
          router.replace("/admin001")
        }
      })
      .catch(() => {
        if (active) router.replace("/admin001")
      })

    return () => {
      active = false
    }
  }, [router])

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats()
      fetchUsers()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated && activeTab === "users") fetchUsers()
    if (isAuthenticated && activeTab === "deposits") fetchDeposits()
    if (isAuthenticated && activeTab === "withdrawals") fetchWithdrawals()
    if (isAuthenticated && activeTab === "kyc") fetchKyc()
    if (isAuthenticated && activeTab === "robo_ia") fetchIaUsers()
    if (isAuthenticated && activeTab === "settings") fetchSettings()
  }, [isAuthenticated, activeTab])

  // Menu items
  const menuItems = [
    { id: "home", label: "Dashboard", icon: Home },
    { id: "users", label: "Usuarios", icon: Users },
    { id: "deposits", label: "Depositos", icon: CreditCard },
    { id: "withdrawals", label: "Saques", icon: Banknote },
    { id: "kyc", label: "KYC", icon: ShieldCheck },
    { id: "robo_ia", label: "Robo IA", icon: Bot },
    { id: "affiliates", label: "Afiliados", icon: UserPlus },
    { id: "promotions", label: "Promocoes", icon: Gift },
    { id: "trades", label: "Operacoes", icon: History },
    { id: "assets", label: "Ativos", icon: CandlestickChart },
    { id: "manipulation", label: "Manipulacao", icon: Zap },
    { id: "cards", label: "Cartoes", icon: CreditCard },
    { id: "settings", label: "Configuracoes", icon: Settings },
  ]

  // Utility functions
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
      case "completed":
        return "bg-green-500/20 text-green-500"
      case "pending":
        return "bg-yellow-500/20 text-yellow-500"
      case "rejected":
      case "failed":
        return "bg-red-500/20 text-red-500"
      default:
        return "bg-gray-500/20 text-gray-500"
    }
  }

  const handleLogout = async () => {
    sessionStorage.removeItem("admin_authenticated")
    // O cookie e HttpOnly, entao apenas o servidor pode apaga-lo.
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {})
    router.replace("/admin001")
  }

  // Fetch functions
  const fetchStats = async () => {
    setStatsLoading(true)
    setError("")
    try {
      const res = await fetch("/api/admin/data?type=stats", {
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao carregar estatísticas")
      setStats(data)
      setStatsRefreshKey((k) => k + 1)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setStatsLoading(false)
    }
  }

  const fetchUsers = async () => {
    setUsersLoading(true)
    try {
      const res = await fetch("/api/admin/data?type=users", {
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao carregar usuários")
      setUsers(data.users || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUsersLoading(false)
    }
  }

  const fetchIaUsers = async () => {
    setIaLoading(true)
    try {
      const res = await fetch("/api/admin/data?type=ia_users", {
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao carregar usuários da IA")
      setIaUsers(data.iaUsers || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIaLoading(false)
    }
  }

  const openIaDetail = async (userId: string) => {
    setIaDetail(null)
    setIaDetailLoading(true)
    try {
      const res = await fetch(`/api/admin/data?type=ia_user_detail&userId=${encodeURIComponent(userId)}`, {
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao carregar detalhes")
      setIaDetail(data.detail)
    } catch (err: any) {
      setError(err.message)
      setIaDetail(null)
    } finally {
      setIaDetailLoading(false)
    }
  }

  const handleSaveAssertiveness = async (userId: string) => {
    const raw = iaDraft[userId]
    const value = Number(raw)
    if (!Number.isFinite(value)) return
    setIaSavingId(userId)
    setIaSuccess(null)
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ action: "set_ia_assertiveness", userId, assertiveness: value }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao salvar assertividade")
      setIaUsers((prev) => prev.map((u) => (u.userId === userId ? { ...u, assertiveness: data.assertiveness } : u)))
      setIaDraft((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
      setIaSuccess(userId)
      setTimeout(() => setIaSuccess(null), 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIaSavingId(null)
    }
  }

  const handleSaveMeta = async (userId: string) => {
    const raw = iaMetaDraft[userId]
    setIaMetaSavingId(userId)
    setIaSuccess(null)
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({
          action: "set_ia_meta",
          userId,
          meta: raw === undefined || raw === "" ? null : Number(raw),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao salvar meta")
      setIaUsers((prev) =>
        prev.map((u) =>
          u.userId === userId
            ? { ...u, metaOverride: data.metaOverride, effectiveMeta: data.effectiveMeta }
            : u,
        ),
      )
      setIaMetaDraft((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
      setIaSuccess(userId)
      setTimeout(() => setIaSuccess(null), 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIaMetaSavingId(null)
    }
  }

  const handleToggleEarning = async (userId: string, enabled: boolean) => {
    setIaEarningSavingId(userId)
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ action: "set_ia_earning", userId, enabled }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao alterar rendimento")
      setIaUsers((prev) =>
        prev.map((u) => (u.userId === userId ? { ...u, earningEnabled: data.earningEnabled } : u)),
      )
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIaEarningSavingId(null)
    }
  }

  const handleToggleLoss = async (userId: string, enabled: boolean) => {
    setIaLossSavingId(userId)
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ action: "set_ia_loss", userId, enabled, lossPerDay: "" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao alterar modo prejuizo")
      setIaUsers((prev) =>
        prev.map((u) =>
          u.userId === userId
            ? { ...u, lossMode: data.lossMode, lossPerDay: data.lossPerDay, lostToday: 0, creditedToday: 0 }
            : u,
        ),
      )
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIaLossSavingId(null)
    }
  }

  const handleTogglePause = async (userId: string, paused: boolean) => {
    setIaPauseSavingId(userId)
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ action: "set_ia_paused", userId, paused }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao alterar pausa")
      setIaUsers((prev) => prev.map((u) => (u.userId === userId ? { ...u, paused: data.paused } : u)))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIaPauseSavingId(null)
    }
  }

  const handleSaveCreditedToday = async (userId: string) => {
    const raw = iaCreditDraft[userId]
    if (raw === undefined || raw === "") return
    const value = Number(raw)
    if (!Number.isFinite(value)) return
    setIaCreditSavingId(userId)
    setIaSuccess(null)
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ action: "set_ia_credited_today", userId, amount: value }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao salvar ganho do dia")
      setIaUsers((prev) =>
        prev.map((u) =>
          u.userId === userId
            ? {
                ...u,
                creditedToday: data.creditedToday,
                lostToday: data.lostToday,
                todayResult: data.todayResult,
                tradesToday: data.tradesToday,
                tradesTotal: data.tradesTotal,
                dayLocked: data.dayLocked,
                totalCredited: data.totalCredited,
                balance_real: data.balance_real,
              }
            : u,
        ),
      )
      setIaCreditDraft((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
      setIaSuccess(userId)
      setTimeout(() => setIaSuccess(null), 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIaCreditSavingId(null)
    }
  }

  const fetchDeposits = async () => {
    setDepositsLoading(true)
    try {
      const res = await fetch("/api/admin/data?type=deposits", {
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao carregar depósitos")
      setDeposits(data.deposits || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDepositsLoading(false)
    }
  }

  const fetchWithdrawals = async () => {
    setWithdrawalsLoading(true)
    try {
      const res = await fetch("/api/admin/data?type=withdrawals", {
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao carregar saques")
      setWithdrawals(data.withdrawals || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setWithdrawalsLoading(false)
    }
  }

  const fetchKyc = async () => {
    setKycLoading(true)
    try {
      const res = await fetch("/api/admin/data?type=kyc", {
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao carregar KYC")
      setKycRequests(data.kycRequests || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setKycLoading(false)
    }
  }

  // Action handlers
  const handleApproveDeposit = async (deposit: any) => {
    console.log("[v0] Approving deposit:", deposit)
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ action: "approve_deposit", data: { depositId: deposit.id, userId: deposit.user_id, amount: deposit.amount } }),
      })
      const responseData = await res.json()
      console.log("[v0] Approve deposit response:", responseData)
      if (!res.ok) throw new Error(responseData.error || "Erro ao aprovar depósito")
      fetchDeposits()
      fetchStats()
    } catch (err: any) {
      console.error("[v0] Approve deposit error:", err)
      setError(err.message)
    }
  }

  const handleRejectDeposit = async (deposit: any) => {
    console.log("[v0] Rejecting deposit:", deposit)
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ action: "reject_deposit", data: { depositId: deposit.id } }),
      })
      const responseData = await res.json()
      console.log("[v0] Reject deposit response:", responseData)
      if (!res.ok) throw new Error(responseData.error || "Erro ao rejeitar depósito")
      fetchDeposits()
      fetchStats()
    } catch (err: any) {
      console.error("[v0] Reject deposit error:", err)
      setError(err.message)
    }
  }

  const handleApproveWithdrawal = async (withdrawal: any) => {
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ action: "approve_withdrawal", data: { withdrawalId: withdrawal.id, userId: withdrawal.user_id, amount: withdrawal.amount } }),
      })
      if (!res.ok) throw new Error("Erro ao aprovar saque")
      fetchWithdrawals()
      fetchStats()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleRejectWithdrawal = async (withdrawal: any) => {
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ action: "reject_withdrawal", data: { withdrawalId: withdrawal.id } }),
      })
      if (!res.ok) throw new Error("Erro ao rejeitar saque")
      fetchWithdrawals()
      fetchStats()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const openEditModal = (user: any) => {
    setEditingUser(user)
    setEditForm({
      full_name: user.full_name || "",
      phone: user.phone || "",
      balance_real: user.balance_real || 0,
      balance_demo: user.balance_demo || 0,
      is_blocked: user.is_blocked || false,
      is_verified: user.is_verified || false,
      is_affiliate: user.is_affiliate || false,
    })
  }

  const handleSaveUser = async () => {
    if (!editingUser) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ action: "update_user", data: { userId: editingUser.id, ...editForm } }),
      })
      if (!res.ok) throw new Error("Erro ao salvar usuário")
      setEditingUser(null)
      fetchUsers()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const openRolloverModal = (user: any) => {
    setRolloverUser(user)
    setRolloverForm({ baseAmount: Number(user.balance_real) || 0, multiplier: 1 })
    setRolloverSuccess(null)
    setError("")
  }

  const handleApplyRollover = async () => {
    if (!rolloverUser) return
    setRolloverSaving(true)
    setError("")
    setRolloverSuccess(null)
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({
          action: "apply_rollover",
          data: {
            userId: rolloverUser.id,
            baseAmount: rolloverForm.baseAmount,
            multiplier: rolloverForm.multiplier,
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao aplicar rollover")
      const required = Number(json.rolloverRequired || 0)
      setRolloverSuccess(
        `Rollover aplicado: o usuário precisa negociar R$ ${required.toFixed(2)} em entradas para liberar o valor.`,
      )
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRolloverSaving(false)
    }
  }

  const handleKycAction = async (actionType: "approve" | "reject", kycId: string, userId: string) => {
    setProcessingKycId(kycId)
    setError("")
    setKycSuccess(null)
    
    try {
      const action = actionType === "approve" ? "approve_kyc" : "reject_kyc"
      const payload: any = { kycId, userId }
      if (actionType === "reject") {
        payload.reason = rejectReason || "Documentos invalidos"
      }
      
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ action, data: payload }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || `Erro ao ${actionType === "approve" ? "aprovar" : "rejeitar"} KYC`)
      }
      
      // Show success animation
      setKycSuccess(kycId)
      
      // Reset reject state if rejecting
      if (actionType === "reject") {
        setRejectingKyc(null)
        setRejectReason("")
      }
      
      // Refresh data after a short delay to show success animation
      setTimeout(() => {
        setKycSuccess(null)
        fetchKyc()
        fetchStats()
      }, 1500)
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessingKycId(null)
    }
  }

  const getSignedUrl = async (path: string) => {
    if (!path) return null
    if (signedUrls[path]) return signedUrls[path]
    try {
      const res = await fetch("/api/admin/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ path }),
      })
      const data = await res.json()
      if (data.url) {
        setSignedUrls((prev) => ({ ...prev, [path]: data.url }))
        return data.url
      }
    } catch (err) {
      console.error("Error getting signed URL:", err)
    }
    return null
  }

  const openDocument = async (path: string, title: string) => {
    if (!path) return
    try {
      const url = await getSignedUrl(path)
      if (url) {
        setImageModal({ open: true, url, title })
      }
    } catch (err) {
      console.error("Error opening document:", err)
    }
  }

  // Filtered users for search + period
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.includes(searchTerm)
    if (!matchesSearch) return false
    if (userDaysFilter === "all") return true
    const cutoff = Date.now() - userDaysFilter * 24 * 60 * 60 * 1000
    return new Date(user.created_at).getTime() >= cutoff
  })

  // Settings functions
  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings", {
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
      const data = await res.json()
      if (data.card_deposit_enabled !== undefined) {
        setCardDepositEnabled(data.card_deposit_enabled === "true" || data.card_deposit_enabled === true)
      }
      if (data.crypto_deposit_enabled !== undefined) {
        setCryptoDepositEnabled(data.crypto_deposit_enabled === "true" || data.crypto_deposit_enabled === true)
      }
      // setting_value e jsonb: o valor pode voltar como boolean/number real ou como string.
      if (data.deposit_rollover_enabled !== undefined) {
        setDepositRolloverEnabled(
          data.deposit_rollover_enabled === "true" || data.deposit_rollover_enabled === true,
        )
      }
      if (data.deposit_rollover_multiplier !== undefined) {
        setDepositRolloverMultiplier(String(data.deposit_rollover_multiplier).replace(/"/g, ""))
      }
      if (data.withdrawal_processing_hours !== undefined) {
        setWithdrawalHours(String(data.withdrawal_processing_hours).replace(/"/g, ""))
      }
    } catch (err) {
      console.error("Error fetching settings:", err)
    } finally {
      setSettingsLoading(false)
    }
  }

  const toggleCardDeposit = async () => {
    setSettingsLoading(true)
    try {
      const newValue = !cardDepositEnabled
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ card_deposit_enabled: newValue }),
      })
      if (res.ok) {
        setCardDepositEnabled(newValue)
      }
    } catch (err) {
      console.error("Error toggling card deposit:", err)
    } finally {
      setSettingsLoading(false)
    }
  }

  const toggleCryptoDeposit = async () => {
    setSettingsLoading(true)
    try {
      const newValue = !cryptoDepositEnabled
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ crypto_deposit_enabled: newValue }),
      })
      if (res.ok) {
        setCryptoDepositEnabled(newValue)
      }
    } catch (err) {
      console.error("Error toggling crypto deposit:", err)
    } finally {
      setSettingsLoading(false)
    }
  }

  /**
   * Liga/desliga o rollover de deposito. Salvo na hora (como os outros toggles) para o admin nao
   * precisar apertar "Salvar" so para desativar a regra.
   */
  const toggleDepositRollover = async () => {
    setSavingRollover(true)
    setRolloverMsg(null)
    try {
      const newValue = !depositRolloverEnabled
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ deposit_rollover_enabled: newValue }),
      })
      if (res.ok) {
        setDepositRolloverEnabled(newValue)
        setRolloverMsg({
          type: "ok",
          text: newValue ? "Rollover de deposito ativado." : "Rollover de deposito desativado.",
        })
      } else {
        setRolloverMsg({ type: "err", text: "Nao foi possivel salvar. Tente novamente." })
      }
    } catch (err) {
      console.error("[v0] Erro ao alternar rollover de deposito:", err)
      setRolloverMsg({ type: "err", text: "Erro de conexao ao salvar." })
    } finally {
      setSavingRollover(false)
    }
  }

  /** Salva o multiplicador do rollover e o prazo de saque. */
  const saveRolloverSettings = async () => {
    setSavingRollover(true)
    setRolloverMsg(null)

    // Aceita virgula como separador decimal, comum em pt-BR.
    const multiplier = Number(depositRolloverMultiplier.replace(",", "."))
    const hours = Number(withdrawalHours)

    if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 100) {
      setRolloverMsg({ type: "err", text: "O multiplicador deve ser um numero entre 0,1 e 100." })
      setSavingRollover(false)
      return
    }

    if (!Number.isInteger(hours) || hours <= 0 || hours > 720) {
      setRolloverMsg({ type: "err", text: "O prazo de saque deve ser um numero inteiro de 1 a 720 horas." })
      setSavingRollover(false)
      return
    }

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({
          deposit_rollover_multiplier: multiplier,
          withdrawal_processing_hours: hours,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        setDepositRolloverMultiplier(String(multiplier))
        setWithdrawalHours(String(hours))
        setRolloverMsg({ type: "ok", text: "Configuracoes salvas." })
      } else {
        setRolloverMsg({ type: "err", text: data.error || "Nao foi possivel salvar." })
      }
    } catch (err) {
      console.error("[v0] Erro ao salvar configuracoes de rollover:", err)
      setRolloverMsg({ type: "err", text: "Erro de conexao ao salvar." })
    } finally {
      setSavingRollover(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F14]">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-[#1E2633]">
        <button onClick={() => setSidebarOpen(true)}>
          <Menu className="w-6 h-6 text-white" />
        </button>
        <Image
          src="/images/uryn-fox-logo.png"
          alt="URYNBROKER"
          width={130}
          height={35}
          priority
          className="h-auto w-[130px]"
        />
        <button onClick={handleLogout}>
          <LogOut className="w-6 h-6 text-red-500" />
        </button>
      </div>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setSidebarOpen(false)}>
          <div className="w-64 h-full bg-[#0B0F14] border-r border-[#1E2633] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <Image
          src="/images/uryn-fox-logo.png"
          alt="URYNBROKER"
          width={130}
          height={35}
          priority
          className="h-auto w-[130px]"
        />
              <button onClick={() => setSidebarOpen(false)}>
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
            <nav className="space-y-2">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any)
                    setSidebarOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${
                    activeTab === item.id ? "bg-orange-500/20 text-orange-500" : "text-gray-400 hover:bg-[#1A1F2E]"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                  {item.id === "kyc" && stats?.pendingKyc ? (
                    <span className="ml-auto px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded">
                      {stats.pendingKyc}
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:flex-col w-64 min-h-screen border-r border-[#1E2633] p-4">
          <div className="mb-8">
            <Image
              src="/images/uryn-fox-logo.png"
              alt="URYNBROKER"
              width={180}
              height={48}
              priority
              className="h-auto w-[180px]"
            />
            <p className="text-gray-400 text-sm mt-2">Painel Admin</p>
          </div>
          <nav className="space-y-2 flex-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${
                  activeTab === item.id ? "bg-orange-500/20 text-orange-500" : "text-gray-400 hover:bg-[#1A1F2E]"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
                {item.id === "kyc" && stats?.pendingKyc ? (
                  <span className="ml-auto px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded">
                    {stats.pendingKyc}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
          <button onClick={handleLogout} className="flex items-center gap-2 text-red-500 hover:text-red-400 mt-auto">
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 lg:p-8 overflow-auto">
          {error && <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-500">{error}</div>}

          {/* Dashboard Tab */}
          {activeTab === "home" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                    </span>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
                  </div>
                  <p className="mt-1 text-sm text-gray-400">Visão geral da operação em tempo real.</p>
                </div>
                <Button
                  onClick={fetchStats}
                  variant="outline"
                  size="sm"
                  className="border-[#1b2333] bg-[#0e1521] text-gray-300 hover:bg-[#141c2b] hover:text-white"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${statsLoading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </div>

              {statsLoading ? (
                <div className="text-center text-gray-400 py-8">Carregando...</div>
              ) : stats ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <StatCard icon={Users} label="Usuários" value={stats.totalUsers} color="blue" />
                  <StatCard
                    icon={TrendingUp}
                    label="Depósitos"
                    value={formatCurrency(stats.totalDeposited || 0)}
                    color="green"
                    badge={(stats.pendingDeposits || 0) > 0 ? `${stats.pendingDeposits} pendentes` : undefined}
                  />
                  <StatCard
                    icon={TrendingDown}
                    label="Saques"
                    value={formatCurrency(stats.totalWithdrawn || 0)}
                    color="red"
                    badge={(stats.pendingWithdrawals || 0) > 0 ? `${stats.pendingWithdrawals} pendentes` : undefined}
                  />
                  <StatCard
                    icon={DollarSign}
                    label="Saldo Total"
                    value={formatCurrency(stats.totalBalanceReal || 0)}
                    color="purple"
                  />
                  <StatCard
                    icon={DollarSign}
                    label="Lucro Plataforma"
                    value={formatCurrency(stats.platformProfit || 0)}
                    color={(stats.platformProfit || 0) >= 0 ? "green" : "red"}
                  />
                  <StatCard
                    icon={ShieldCheck}
                    label="KYC Pendente"
                    value={stats.pendingKyc || 0}
                    color="yellow"
                    badge={(stats.pendingKyc || 0) > 0 ? "Aguardando análise" : undefined}
                  />
                </div>
              ) : null}

              {!statsLoading && stats ? <AdminCharts refreshKey={statsRefreshKey} /> : null}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === "users" && (
            <div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-white">Usuários</h1>
                  <p className="text-gray-400">
                    {filteredUsers.length}
                    {filteredUsers.length !== users.length ? ` de ${users.length}` : ""} usuários
                    {userDaysFilter !== "all" ? ` · últimos ${userDaysFilter} dias` : " cadastrados"}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 bg-[#1A1F2E] border-[#2A3142] text-white"
                    />
                  </div>
                  <Button
                    onClick={fetchUsers}
                    variant="outline"
                    size="icon"
                    className="border-[#2A3142] bg-transparent"
                  >
                    <RefreshCw className="w-4 h-4 text-gray-300" />
                  </Button>
                </div>
              </div>

              {/* Filtro por período */}
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-500">Período:</span>
                {([
                  { label: "Hoje", value: 1 },
                  { label: "7 dias", value: 7 },
                  { label: "30 dias", value: 30 },
                  { label: "90 dias", value: 90 },
                  { label: "Todos", value: "all" as const },
                ]).map((opt) => {
                  const active = userDaysFilter === opt.value
                  return (
                    <button
                      key={String(opt.value)}
                      onClick={() => setUserDaysFilter(opt.value)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "bg-orange-500 text-white"
                          : "border border-[#2A3142] bg-[#11161f] text-gray-400 hover:bg-[#171d28] hover:text-gray-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              <UsersChart refreshKey={statsRefreshKey} />

              {usersLoading ? (
                <div className="text-center text-gray-400 py-8">Carregando...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center text-gray-400 py-8">Nenhum usuário encontrado</div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="bg-[#1A1F2E] rounded-xl p-4 border border-[#2A3142]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-white font-medium truncate">{user.email}</p>
                            {user.is_blocked && (
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-500 text-xs rounded">Bloqueado</span>
                            )}
  {user.is_verified && (
  <span className="px-2 py-0.5 bg-orange-500/20 text-orange-500 text-xs rounded">
  Verificado
  </span>
  )}
  {user.is_affiliate && (
  <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-xs rounded">
  Afiliado
  </span>
  )}
  </div>
                          <p className="text-gray-400 text-sm">{user.full_name || "Sem nome"}</p>
                          <p className="text-gray-500 text-xs">{formatDate(user.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-green-500 font-bold">{formatCurrency(user.balance_real)}</p>
                            <p className="text-gray-500 text-xs">Demo: {formatCurrency(user.balance_demo)}</p>
                            {user.rollover && user.rollover.remaining > 0 && (
                              <p className="text-orange-400 text-xs mt-1 flex items-center justify-end gap-1">
                                <Repeat className="w-3 h-3" />
                                Rollover: falta {formatCurrency(user.rollover.remaining)}
                              </p>
                            )}
                            {user.rollover && user.rollover.remaining <= 0 && (
                              <p className="text-green-400 text-xs mt-1">Rollover concluído</p>
                            )}
                          </div>
                          <Button
                            onClick={() => openRolloverModal(user)}
                            size="sm"
                            variant="outline"
                            className="border-[#2A3142] text-orange-400 hover:text-orange-300"
                          >
                            <Repeat className="w-4 h-4" />
                            <span className="ml-1 hidden sm:inline">Rollover</span>
                          </Button>
                          <Button
                            onClick={() => openEditModal(user)}
                            size="sm"
                            variant="outline"
                            className="border-[#2A3142]"
                          >
                            <Edit className="w-4 h-4 text-gray-300" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Deposits Tab */}
          {activeTab === "deposits" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-white">Depósitos</h1>
                  <p className="text-gray-400">{deposits.length} depósitos</p>
                </div>
                <Button
                  onClick={fetchDeposits}
                  variant="outline"
                  size="sm"
                  className="border-[#2A3142] text-gray-300 bg-transparent"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar
                </Button>
              </div>

              <DepositsChart refreshKey={statsRefreshKey} />

              {depositsLoading ? (
                <div className="text-center text-gray-400 py-8">Carregando...</div>
              ) : deposits.length === 0 ? (
                <div className="text-center text-gray-400 py-8">Nenhum depósito encontrado</div>
              ) : (
                <div className="space-y-3">
                  {deposits.map((deposit) => (
                    <div key={deposit.id} className="bg-[#1A1F2E] rounded-xl p-4 border border-[#2A3142]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-white font-medium">{deposit.user_email || "Usuário"}</p>
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              deposit.method === "crypto" ? "bg-yellow-500/20 text-yellow-500" :
                              deposit.method === "card" ? "bg-orange-500/20 text-orange-500" :
                              "bg-green-500/20 text-green-500"
                            }`}>
                              {deposit.method === "crypto" ? "USDT" : deposit.method === "card" ? "Cartao" : "PIX"}
                            </span>
                          </div>
                          <p className="text-gray-400 text-sm">{deposit.user_name || ""}</p>
                          <p className="text-gray-500 text-xs">{formatDate(deposit.created_at)}</p>
                          
                          {/* Show crypto details */}
                          {deposit.method === "crypto" && deposit.payment_details && (
                            <div className="mt-2 p-2 rounded-lg bg-[#0B0F14] text-xs">
                              <p className="text-yellow-400">
                                <span className="text-gray-500">Valor USD:</span> ${deposit.payment_details.amount_usd}
                              </p>
                              <p className="text-cyan-400 break-all">
                                <span className="text-gray-500">TX Hash:</span> {deposit.payment_details.tx_hash || deposit.external_id}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-white font-bold">{formatCurrency(deposit.amount)}</p>
                            <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(deposit.status)}`}>
                              {deposit.status}
                            </span>
                          </div>
                          {deposit.status === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleApproveDeposit(deposit)}
                                size="sm"
                                className="bg-green-500 hover:bg-green-600"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button onClick={() => handleRejectDeposit(deposit)} size="sm" variant="destructive">
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Withdrawals Tab */}
          {activeTab === "withdrawals" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-white">Saques</h1>
                  <p className="text-gray-400">{withdrawals.length} saques</p>
                </div>
                <Button
                  onClick={fetchWithdrawals}
                  variant="outline"
                  size="sm"
                  className="border-[#2A3142] text-gray-300 bg-transparent"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar
                </Button>
              </div>

              {withdrawalsLoading ? (
                <div className="text-center text-gray-400 py-8">Carregando...</div>
              ) : withdrawals.length === 0 ? (
                <div className="text-center text-gray-400 py-8">Nenhum saque encontrado</div>
              ) : (
                <div className="space-y-3">
                  {withdrawals.map((withdrawal) => (
                    <div key={withdrawal.id} className="bg-[#1A1F2E] rounded-xl p-4 border border-[#2A3142]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-white font-medium">{withdrawal.user_email || "Usuário"}</p>
                          <p className="text-gray-400 text-sm">{withdrawal.user_name || ""}</p>
                          <p className="text-gray-500 text-xs">{formatDate(withdrawal.created_at)}</p>

                          {withdrawal.payment_details?.pix_key && (
                            <div className="mt-2 p-2 rounded-lg bg-[#0B0F14]">
                              <p className="text-cyan-400 text-xs">
                                <span className="text-gray-500">Chave PIX:</span> {withdrawal.payment_details.pix_key}
                              </p>
                              {withdrawal.payment_details.pix_key_type && (
                                <p className="text-cyan-400 text-xs">
                                  <span className="text-gray-500">Tipo:</span>{" "}
                                  {withdrawal.payment_details.pix_key_type === "cpf"
                                    ? "CPF"
                                    : withdrawal.payment_details.pix_key_type === "email"
                                      ? "E-mail"
                                      : withdrawal.payment_details.pix_key_type === "phone"
                                        ? "Celular"
                                        : "Chave Aleatória"}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-white font-bold">{formatCurrency(withdrawal.amount)}</p>
                            <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(withdrawal.status)}`}>
                              {withdrawal.status}
                            </span>
                          </div>
                          {withdrawal.status === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleApproveWithdrawal(withdrawal)}
                                size="sm"
                                className="bg-green-500 hover:bg-green-600"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => handleRejectWithdrawal(withdrawal)}
                                size="sm"
                                variant="destructive"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* KYC Tab */}
          {activeTab === "kyc" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-white">Verificação KYC</h1>
                  <p className="text-gray-400">{kycRequests.length} solicitações</p>
                </div>
                <Button
                  onClick={fetchKyc}
                  variant="outline"
                  size="sm"
                  className="border-[#2A3142] text-gray-300 bg-transparent"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar
                </Button>
              </div>

              {kycLoading ? (
                <div className="text-center text-gray-400 py-8">Carregando...</div>
              ) : kycRequests.length === 0 ? (
                <div className="text-center text-gray-400 py-8">Nenhuma solicitação de KYC</div>
              ) : (
                <div className="space-y-4">
                  {kycRequests.map((kyc) => (
                    <div key={kyc.id} className="bg-[#1A1F2E] rounded-xl p-4 border border-[#2A3142]">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <p className="text-white font-medium">{kyc.user_email || "Usuário"}</p>
                            <p className="text-gray-400 text-sm">{kyc.user_name || ""}</p>
                            <p className="text-gray-500 text-xs">{formatDate(kyc.created_at)}</p>
                          </div>
                          <span className={`px-3 py-1 text-sm rounded ${getStatusColor(kyc.status)}`}>
                            {kyc.status === "pending"
                              ? "Pendente"
                              : kyc.status === "approved"
                                ? "Aprovado"
                                : "Rejeitado"}
                          </span>
                        </div>

                        {/* Document Images - Clickable buttons */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-gray-400 text-xs mb-1">Frente</p>
                            <button
                              onClick={() => openDocument(kyc.document_front_url, "Documento - Frente")}
                              disabled={!kyc.document_front_url || kycLoading || loading}
                              className="w-full aspect-video bg-[#0B0F14] rounded-lg border border-[#2A3142] flex items-center justify-center hover:border-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {kyc.document_front_url ? (
                                <Eye className="h-5 w-5 text-green-500" />
                              ) : (
                                <span className="text-gray-500 text-xs">Não enviado</span>
                              )}
                            </button>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs mb-1">Verso</p>
                            <button
                              onClick={() => openDocument(kyc.document_back_url, "Documento - Verso")}
                              disabled={!kyc.document_back_url || kycLoading || loading}
                              className="w-full aspect-video bg-[#0B0F14] rounded-lg border border-[#2A3142] flex items-center justify-center hover:border-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {kyc.document_back_url ? (
                                <Eye className="h-5 w-5 text-green-500" />
                              ) : (
                                <span className="text-gray-500 text-xs">Não enviado</span>
                              )}
                            </button>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs mb-1">Selfie</p>
                            <button
                              onClick={() => openDocument(kyc.selfie_with_document_url, "Selfie com Documento")}
                              disabled={!kyc.selfie_with_document_url || kycLoading || loading}
                              className="w-full aspect-video bg-[#0B0F14] rounded-lg border border-[#2A3142] flex items-center justify-center hover:border-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {kyc.selfie_with_document_url ? (
                                <Eye className="h-5 w-5 text-green-500" />
                              ) : (
                                <span className="text-gray-500 text-xs">Não enviado</span>
                              )}
                            </button>
                          </div>
                        </div>

                        {kyc.rejection_reason && <p className="text-red-400 text-sm">Motivo: {kyc.rejection_reason}</p>}

                        {/* Success animation */}
                        {kycSuccess === kyc.id && (
                          <div className="flex items-center justify-center py-4 bg-green-500/20 rounded-lg border border-green-500/50 animate-pulse">
                            <Check className="w-6 h-6 text-green-500 mr-2" />
                            <span className="text-green-500 font-medium">Aprovado com sucesso!</span>
                          </div>
                        )}

                        {kyc.status === "pending" && !kycSuccess && (
                          <>
                            {rejectingKyc === kyc.id ? (
                              <div className="flex flex-col gap-2">
                                <Input
                                  placeholder="Motivo da rejeição..."
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  className="bg-[#0B0F14] border-[#2A3142] text-white"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => {
                                      setRejectingKyc(null)
                                      setRejectReason("")
                                    }}
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 border-[#2A3142]"
                                    disabled={processingKycId === kyc.id}
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    onClick={() => handleKycAction("reject", kyc.id, kyc.user_id)}
                                    size="sm"
                                    variant="destructive"
                                    className="flex-1"
                                    disabled={processingKycId === kyc.id}
                                  >
                                    {processingKycId === kyc.id ? (
                                      <>
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                        Rejeitando...
                                      </>
                                    ) : (
                                      "Confirmar Rejeição"
                                    )}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleKycAction("approve", kyc.id, kyc.user_id)}
                                  size="sm"
                                  className="flex-1 bg-green-500 hover:bg-green-600"
                                  disabled={processingKycId === kyc.id}
                                >
                                  {processingKycId === kyc.id ? (
                                    <>
                                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                      Aprovando...
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-4 h-4 mr-2" />
                                      Aprovar
                                    </>
                                  )}
                                </Button>
                                <Button
                                  onClick={() => setRejectingKyc(kyc.id)}
                                  size="sm"
                                  variant="destructive"
                                  className="flex-1"
                                  disabled={processingKycId === kyc.id}
                                >
                                  <X className="w-4 h-4 mr-2" />
                                  Rejeitar
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Image Modal */}
              {imageModal.open && (
                <div
                  className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                  onClick={() => setImageModal({ open: false, url: "", title: "" })}
                >
                  <div className="relative max-w-4xl w-full max-h-[90vh]">
                    <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent z-10">
                      <h3 className="text-white font-medium">{imageModal.title}</h3>
                      <button
                        onClick={() => setImageModal({ open: false, url: "", title: "" })}
                        className="p-2 bg-white/10 rounded-full hover:bg-white/20"
                      >
                        <X className="h-5 w-5 text-white" />
                      </button>
                    </div>
                    <div className="flex items-center justify-center min-h-[300px]">
                      <img
                        src={imageModal.url || "/placeholder.svg"}
                        alt={imageModal.title}
                        className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = "/documento-n-o-encontrado.jpg"
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Trades/Operações Tab */}
          {activeTab === "trades" && (
            <TradeEditor
              users={users.map((u) => ({ id: u.id, email: u.email, full_name: u.full_name }))}
              onRefresh={() => {
                fetchUsers()
                fetchStats()
              }}
            />
          )}

          {/* Robo IA Tab */}
          {activeTab === "robo_ia" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Bot className="w-5 h-5 text-primary" />
                    Robo IA
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Usuarios com a IA ativa, resultados e controle de assertividade.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchIaUsers}
                  disabled={iaLoading}
                  className="border-[#2A3142] text-gray-300"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${iaLoading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </div>

              {/* Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#1A1F2E] rounded-xl p-4 border border-[#2A3142]">
                  <p className="text-xs text-gray-400">IAs ativas</p>
                  <p className="text-lg font-bold text-white">{iaUsers.length}</p>
                </div>
                <div className="bg-[#1A1F2E] rounded-xl p-4 border border-[#2A3142]">
                  <p className="text-xs text-gray-400">Total investido</p>
                  <p className="text-lg font-bold text-white">
                    {formatCurrency(iaUsers.reduce((s, u) => s + Number(u.amount || 0), 0))}
                  </p>
                </div>
                <div className="bg-[#1A1F2E] rounded-xl p-4 border border-[#2A3142]">
                  <p className="text-xs text-gray-400">Rendimento gerado</p>
                  <p className="text-lg font-bold text-green-500">
                    {formatCurrency(iaUsers.reduce((s, u) => s + Number(u.totalCredited || 0), 0))}
                  </p>
                </div>
                <div className="bg-[#1A1F2E] rounded-xl p-4 border border-[#2A3142]">
                  <p className="text-xs text-gray-400">Resultado hoje</p>
                  {(() => {
                    const sum = iaUsers.reduce(
                      (s, u) =>
                        s + Number(u.todayResult ?? (u.lossMode ? -Number(u.lostToday || 0) : Number(u.creditedToday || 0))),
                      0,
                    )
                    return (
                      <p className={`text-lg font-bold ${sum < 0 ? "text-red-400" : "text-green-500"}`}>
                        {formatCurrency(sum)}
                      </p>
                    )
                  })()}
                </div>
              </div>

              {iaLoading ? (
                <div className="text-center py-10 text-gray-400">Carregando...</div>
              ) : iaUsers.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-[#1A1F2E] rounded-xl border border-[#2A3142]">
                  Nenhum usuario com a IA ativa no momento.
                </div>
              ) : (
                <div className="space-y-3">
                  {iaUsers.map((u) => {
                    const draft = iaDraft[u.userId]
                    const dirty = draft !== undefined && Number(draft) !== Number(u.assertiveness)
                    const meta = Number(u.effectiveMeta ?? u.dailyMeta ?? 0)
                    const lossOn = u.lossMode === true
                    const earningOff = u.earningEnabled === false
                    const today = Number(
                      u.todayResult ?? (lossOn ? -Number(u.lostToday || 0) : Number(u.creditedToday || 0)),
                    )
                    const negative = today < 0
                    const lossTarget = Number(u.lossPerDay || meta)
                    const remaining = lossOn
                      ? Math.max(0, Math.round((lossTarget + today) * 100) / 100)
                      : Math.max(0, Math.round((meta - today) * 100) / 100)
                    const progress = lossOn
                      ? lossTarget > 0
                        ? Math.min(100, Math.max(0, Math.round((-today / lossTarget) * 100)))
                        : 0
                      : meta > 0
                        ? Math.min(100, Math.max(0, Math.round((today / meta) * 100)))
                        : 0
                    const pctOfMeta = meta > 0 ? Math.round((today / meta) * 100) : 0
                    const metaReached = !lossOn && meta > 0 && today >= meta
                    const dayLocked = u.dayLocked === true
                    const statusBadge = lossOn
                      ? { label: "Em prejuizo", cls: "bg-red-500/20 text-red-400" }
                      : earningOff
                        ? { label: "Sem rendimento", cls: "bg-red-500/20 text-red-400" }
                        : negative
                          ? { label: "Perdendo hoje", cls: "bg-red-500/20 text-red-400" }
                          : { label: "Ganhando", cls: "bg-green-500/10 text-green-400" }
                    const valueColor = (n: number) => (n < 0 ? "text-red-400" : "text-green-500")
                    return (
                      <div
                        key={u.userId}
                        className="bg-[#1A1F2E] rounded-xl p-4 border border-[#2A3142]"
                      >
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-white truncate">{u.user_name}</p>
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full ${
                                  u.paused ? "bg-gray-500/20 text-gray-400" : "bg-green-500/20 text-green-500"
                                }`}
                              >
                                {u.paused ? "Pausada" : "Operando"}
                              </span>
                              <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusBadge.cls}`}>
                                {statusBadge.label}
                              </span>
                              {metaReached ? (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                                  Meta batida
                                </span>
                              ) : null}
                              {dayLocked ? (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                                  Dia fixado pelo admin
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-gray-400 truncate">{u.user_email}</p>
                            <p className="text-[11px] text-gray-500 mt-1">
                              Plano {formatCurrency(u.amount)} · {u.daily}% ao dia
                              {u.activatedAt ? ` · desde ${formatDate(u.activatedAt)}` : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400">Saldo na carteira</p>
                            <p className="font-bold text-white">{formatCurrency(u.balance_real)}</p>
                          </div>
                        </div>

                        {/* Progresso da meta de hoje */}
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-gray-400">
                              {lossOn ? "Progresso do prejuizo de hoje" : "Progresso da meta de hoje"}
                            </span>
                            <span
                              className={
                                metaReached
                                  ? "text-primary font-semibold"
                                  : negative
                                    ? "text-red-400"
                                    : "text-gray-300"
                              }
                            >
                              {formatCurrency(today)} / {lossOn ? `-${formatCurrency(lossTarget)}` : formatCurrency(meta)}{" "}
                              ({lossOn ? progress : pctOfMeta}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-[#0B0F14] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                lossOn || negative ? "bg-red-500" : metaReached ? "bg-primary" : "bg-green-500"
                              }`}
                              style={{ width: `${negative && !lossOn ? 100 : progress}%`, opacity: negative && !lossOn ? 0.35 : 1 }}
                            />
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1">
                            {lossOn ? "Falta perder hoje" : "Falta hoje"}: {formatCurrency(remaining)}
                          </p>
                        </div>

                        {/* Resultados detalhados */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
                          <div className="bg-[#0B0F14] rounded-lg p-3">
                            <p className="text-[11px] text-gray-400">Rendimento total</p>
                            <p className={`font-semibold ${valueColor(Number(u.totalCredited || 0))}`}>
                              {formatCurrency(u.totalCredited)}
                            </p>
                          </div>
                          <div className="bg-[#0B0F14] rounded-lg p-3">
                            <p className="text-[11px] text-gray-400">Resultado hoje</p>
                            <p className={`font-semibold ${valueColor(today)}`}>{formatCurrency(today)}</p>
                          </div>
                          <div className="bg-[#0B0F14] rounded-lg p-3">
                            <p className="text-[11px] text-gray-400">Entradas hoje</p>
                            <p className="font-semibold text-white">{Number(u.tradesToday || 0)}</p>
                            <p className="text-[10px] text-gray-500">{Number(u.tradesTotal || 0)} no total</p>
                          </div>
                          <div className="bg-[#0B0F14] rounded-lg p-3">
                            <p className="text-[11px] text-gray-400">Meta diaria</p>
                            <p className="font-semibold text-white">{formatCurrency(meta)}</p>
                            {u.metaOverride != null ? (
                              <p className="text-[10px] text-primary">personalizada</p>
                            ) : (
                              <p className="text-[10px] text-gray-500">padrao do plano</p>
                            )}
                          </div>
                          <div className="bg-[#0B0F14] rounded-lg p-3">
                            <p className="text-[11px] text-gray-400">Assertividade</p>
                            <p className="font-semibold text-primary">{u.assertiveness}%</p>
                          </div>
                        </div>

                        {/* Controle do ganho de hoje */}
                        <div className="mt-4 border-t border-[#2A3142] pt-4">
                          <p className="text-xs font-semibold text-white mb-2">Controlar resultado de hoje</p>
                          <div className="flex items-end gap-3 flex-wrap">
                            <div className="flex-1 min-w-[140px]">
                              <label className="text-[11px] text-gray-400 block mb-1">
                                Resultado de hoje (R$) — use valor negativo para perda
                              </label>
                              <Input
                                type="number"
                                step="0.01"
                                inputMode="decimal"
                                placeholder={formatCurrency(today)}
                                value={iaCreditDraft[u.userId] ?? String(today)}
                                onChange={(e) =>
                                  setIaCreditDraft((prev) => ({ ...prev, [u.userId]: e.target.value }))
                                }
                                className="w-full bg-[#0B0F14] border-[#2A3142] text-white h-11 text-base"
                              />
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleSaveCreditedToday(u.userId)}
                              disabled={iaCreditSavingId === u.userId}
                              className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 min-w-[90px]"
                            >
                              {iaCreditSavingId === u.userId ? "..." : "Definir"}
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIaCreditDraft((prev) => ({ ...prev, [u.userId]: String(meta) }))}
                              className="border-[#2A3142] text-gray-300 h-9"
                            >
                              Bater meta ({formatCurrency(meta)})
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIaCreditDraft((prev) => ({ ...prev, [u.userId]: "0" }))}
                              className="border-[#2A3142] text-gray-300 h-9"
                            >
                              Zerar hoje
                            </Button>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-2">
                            A diferenca vira uma entrada real (min. R$ 1,00) no historico da tela de Trade e entra
                            (ou sai) do saldo real. Depois disso a IA nao abre novas entradas hoje; mudar a meta ou
                            o modo prejuizo libera a IA de novo.
                          </p>
                        </div>

                        {/* Modo prejuizo: usuario perde dinheiro no dia */}
                        <div
                          className={`mt-4 border-t border-[#2A3142] pt-4 -mx-4 px-4 ${
                            lossOn ? "bg-red-500/5" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-xs font-semibold text-white">Modo prejuizo (perder no dia)</p>
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full ${
                                lossOn ? "bg-red-500/20 text-red-400" : "bg-gray-500/20 text-gray-400"
                              }`}
                            >
                              {lossOn ? "Ativo" : "Desligado"}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 mb-3">
                            Ligado, em vez de render o saldo do usuario cai aos poucos ate a meta do dia. As entradas do
                            dia fecham no vermelho no historico da tela de Trade.
                          </p>
                          <Button
                            size="sm"
                            onClick={() => handleToggleLoss(u.userId, !lossOn)}
                            disabled={iaLossSavingId === u.userId}
                            className={
                              lossOn
                                ? "w-full bg-green-600 hover:bg-green-600/90 text-white h-11"
                                : "w-full bg-red-600 hover:bg-red-600/90 text-white h-11"
                            }
                          >
                            {iaLossSavingId === u.userId
                              ? "..."
                              : lossOn
                                ? "Parar prejuizo"
                                : "Colocar em prejuizo"}
                          </Button>
                          {lossOn ? (
                            <p className="text-[10px] text-red-400 mt-2">
                              Perda de hoje ate agora: {formatCurrency(Number(u.lostToday || 0))}. O saldo nunca fica
                              negativo.
                            </p>
                          ) : (
                            <p className="text-[10px] text-gray-500 mt-2">
                              Usa a meta do plano como valor do prejuizo. O saldo nunca fica negativo.
                            </p>
                          )}
                        </div>

                        {/* Acoes: ligar/desligar rendimento, pausar, detalhes */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 border-t border-[#2A3142] pt-4">
                          <Button
                            size="sm"
                            onClick={() => handleToggleEarning(u.userId, earningOff)}
                            disabled={iaEarningSavingId === u.userId}
                            className={
                              earningOff
                                ? "bg-green-600 hover:bg-green-600/90 text-white h-11"
                                : "bg-red-600 hover:bg-red-600/90 text-white h-11"
                            }
                          >
                            {iaEarningSavingId === u.userId
                              ? "..."
                              : earningOff
                                ? "Ligar rendimento"
                                : "Desligar rendimento"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTogglePause(u.userId, !u.paused)}
                            disabled={iaPauseSavingId === u.userId}
                            className="border-[#2A3142] text-gray-300 h-11"
                          >
                            {iaPauseSavingId === u.userId ? "..." : u.paused ? "Retomar IA" : "Pausar IA"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openIaDetail(u.userId)}
                            className="border-[#2A3142] text-gray-300 h-11"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Detalhes
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Modal de detalhes do usuario da IA */}
          {(iaDetail || iaDetailLoading) && (
            <div
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
              onClick={() => {
                setIaDetail(null)
                setIaDetailLoading(false)
              }}
            >
              <div
                className="bg-[#1A1F2E] w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-[#2A3142] max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-[#2A3142] sticky top-0 bg-[#1A1F2E]">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Bot className="w-5 h-5 text-primary" />
                    Detalhes da IA
                  </h3>
                  <button
                    onClick={() => {
                      setIaDetail(null)
                      setIaDetailLoading(false)
                    }}
                    className="text-gray-400 hover:text-white"
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {iaDetailLoading || !iaDetail ? (
                  <div className="p-10 text-center text-gray-400">Carregando detalhes...</div>
                ) : (
                  <div className="p-4 space-y-4">
                    {/* Identificacao */}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">{iaDetail.user_name}</p>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full ${
                            iaDetail.paused ? "bg-gray-500/20 text-gray-400" : "bg-green-500/20 text-green-500"
                          }`}
                        >
                          {iaDetail.paused ? "Pausada" : "Operando"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{iaDetail.user_email}</p>
                      {iaDetail.phone ? <p className="text-xs text-gray-500">{iaDetail.phone}</p> : null}
                      {iaDetail.member_since ? (
                        <p className="text-[11px] text-gray-500 mt-1">Cliente desde {formatDate(iaDetail.member_since)}</p>
                      ) : null}
                    </div>

                    {/* Plano e datas */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#0B0F14] rounded-lg p-3">
                        <p className="text-[11px] text-gray-400">Plano investido</p>
                        <p className="font-semibold text-white">{formatCurrency(iaDetail.amount)}</p>
                        <p className="text-[11px] text-gray-500">{iaDetail.daily}% ao dia</p>
                      </div>
                      <div className="bg-[#0B0F14] rounded-lg p-3">
                        <p className="text-[11px] text-gray-400">Saldo na carteira</p>
                        <p className="font-semibold text-white">{formatCurrency(iaDetail.balance_real)}</p>
                      </div>
                      <div className="bg-[#0B0F14] rounded-lg p-3">
                        <p className="text-[11px] text-gray-400">Ativada em</p>
                        <p className="font-medium text-white text-sm">
                          {iaDetail.activatedAt ? formatDate(iaDetail.activatedAt) : "-"}
                        </p>
                      </div>
                      <div className="bg-[#0B0F14] rounded-lg p-3">
                        <p className="text-[11px] text-gray-400">Ultimo acerto</p>
                        <p className="font-medium text-white text-sm">
                          {iaDetail.lastSettleAt ? formatDate(iaDetail.lastSettleAt) : "-"}
                        </p>
                      </div>
                    </div>

                    {/* Resultados */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#0B0F14] rounded-lg p-3">
                        <p className="text-[11px] text-gray-400">Rendimento total</p>
                        <p className="font-semibold text-green-500">{formatCurrency(iaDetail.totalCredited)}</p>
                      </div>
                      <div className="bg-[#0B0F14] rounded-lg p-3">
                        <p className="text-[11px] text-gray-400">Creditado hoje</p>
                        <p className="font-semibold text-green-500">{formatCurrency(iaDetail.creditedToday)}</p>
                      </div>
                      <div className="bg-[#0B0F14] rounded-lg p-3">
                        <p className="text-[11px] text-gray-400">Meta diaria</p>
                        <p className="font-semibold text-white">{formatCurrency(iaDetail.dailyMeta)}</p>
                      </div>
                      <div className="bg-[#0B0F14] rounded-lg p-3">
                        <p className="text-[11px] text-gray-400">Assertividade</p>
                        <p className="font-semibold text-primary">{iaDetail.assertiveness}%</p>
                      </div>
                    </div>

                    {/* Historico de movimentacoes */}
                    <div>
                      <p className="text-sm font-semibold text-white mb-2">
                        Historico da IA{" "}
                        <span className="text-xs text-gray-500 font-normal">
                          ({iaDetail.yieldCount} rendimentos)
                        </span>
                      </p>
                      {iaDetail.transactions.length === 0 ? (
                        <p className="text-xs text-gray-500 bg-[#0B0F14] rounded-lg p-3">
                          Nenhuma movimentacao registrada ainda.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {iaDetail.transactions.map((t: any) => {
                            const isPositive = Number(t.amount) >= 0
                            const label =
                              t.type === "ia_invest"
                                ? "Investimento"
                                : t.type === "ia_refund"
                                  ? "Devolucao"
                                  : "Rendimento"
                            return (
                              <div
                                key={t.id}
                                className="flex items-center justify-between bg-[#0B0F14] rounded-lg p-3 gap-3"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm text-white">{label}</p>
                                  <p className="text-[11px] text-gray-500">{formatDate(t.created_at)}</p>
                                </div>
                                <p
                                  className={`text-sm font-semibold shrink-0 ${
                                    isPositive ? "text-green-500" : "text-red-500"
                                  }`}
                                >
                                  {isPositive ? "+" : ""}
                                  {formatCurrency(Number(t.amount))}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Affiliates Tab */}
          {activeTab === "affiliates" && <AdminAffiliates />}

          {activeTab === "promotions" && <AdminPromotions />}

          {activeTab === "cards" && <AdminCards />}

            {/* Ativos Tab */}
            {activeTab === "assets" && <AdminAssets />}

            {/* Manipulacao Tab */}
            {activeTab === "manipulation" && <AdminManipulation />}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white">Configuracoes da Plataforma</h2>
              
              <div className="bg-[#1A1F2E] rounded-xl p-6 border border-[#2A3142]">
                <h3 className="text-lg font-semibold text-white mb-4">Metodos de Deposito</h3>
                
                <div className="space-y-4">
                  {/* Card Deposit Toggle */}
                  <div className="flex items-center justify-between p-4 bg-[#0B0F14] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Deposito via Cartao</p>
                        <p className="text-gray-400 text-sm">Permitir depositos usando cartao de credito/debito</p>
                      </div>
                    </div>
                    <button
                      onClick={toggleCardDeposit}
                      disabled={settingsLoading}
                      className={`relative w-14 h-7 rounded-full transition-colors ${
                        cardDepositEnabled ? "bg-green-500" : "bg-gray-600"
                      } ${settingsLoading ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                          cardDepositEnabled ? "right-1" : "left-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* PIX Always Enabled */}
                  <div className="flex items-center justify-between p-4 bg-[#0B0F14] rounded-lg opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Deposito via PIX</p>
                        <p className="text-gray-400 text-sm">Sempre habilitado</p>
                      </div>
                    </div>
                    <div className="w-14 h-7 rounded-full bg-green-500 relative">
                      <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white" />
                    </div>
                  </div>

                  {/* Crypto Deposit Toggle */}
                  <div className="flex items-center justify-between p-4 bg-[#0B0F14] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                        <span className="text-yellow-500 font-bold text-sm">USDT</span>
                      </div>
                      <div>
                        <p className="text-white font-medium">Deposito via Cripto (USDT)</p>
                        <p className="text-gray-400 text-sm">Permitir depositos usando USDT na rede Ethereum (minimo $20)</p>
                      </div>
                    </div>
                    <button
                      onClick={toggleCryptoDeposit}
                      disabled={settingsLoading}
                      className={`relative w-14 h-7 rounded-full transition-colors ${
                        cryptoDepositEnabled ? "bg-green-500" : "bg-gray-600"
                      } ${settingsLoading ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                          cryptoDepositEnabled ? "right-1" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <p className="text-gray-500 text-xs mt-4">
                  As alteracoes sao aplicadas imediatamente para todos os usuarios.
                </p>
              </div>

              {/* Rollover de deposito e prazo de saque */}
              <div className="bg-[#1A1F2E] rounded-xl p-6 border border-[#2A3142]">
                <h3 className="text-lg font-semibold text-white mb-4">Rollover e Saques</h3>

                <div className="space-y-4">
                  {/* Liga/desliga o rollover de deposito */}
                  <div className="flex items-center justify-between gap-4 p-4 bg-[#0B0F14] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                        <Repeat className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Rollover de Deposito</p>
                        <p className="text-gray-400 text-sm">
                          Exigir volume negociado antes de liberar o valor depositado para saque
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={toggleDepositRollover}
                      disabled={savingRollover}
                      role="switch"
                      aria-checked={depositRolloverEnabled}
                      aria-label="Ativar rollover de deposito"
                      className={`relative w-14 h-7 rounded-full transition-colors shrink-0 ${
                        depositRolloverEnabled ? "bg-green-500" : "bg-gray-600"
                      } ${savingRollover ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                          depositRolloverEnabled ? "right-1" : "left-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="p-4 bg-[#0B0F14] rounded-lg">
                      <label htmlFor="rollover-multiplier" className="text-white font-medium text-sm">
                        Multiplicador do rollover
                      </label>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          id="rollover-multiplier"
                          type="text"
                          inputMode="decimal"
                          value={depositRolloverMultiplier}
                          onChange={(e) => setDepositRolloverMultiplier(e.target.value)}
                          disabled={savingRollover}
                          className="bg-[#1A1F2E] border-[#2A3142] text-white"
                        />
                        <span className="text-gray-400 text-sm shrink-0">x o deposito</span>
                      </div>
                      <p className="text-gray-500 text-xs mt-2">
                        {"Com 2x, um deposito de R$ 100 exige R$ 200 em operacoes reais."}
                      </p>
                    </div>

                    <div className="p-4 bg-[#0B0F14] rounded-lg">
                      <label htmlFor="withdrawal-hours" className="text-white font-medium text-sm">
                        Prazo de processamento do saque
                      </label>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          id="withdrawal-hours"
                          type="text"
                          inputMode="numeric"
                          value={withdrawalHours}
                          onChange={(e) => setWithdrawalHours(e.target.value)}
                          disabled={savingRollover}
                          className="bg-[#1A1F2E] border-[#2A3142] text-white"
                        />
                        <span className="text-gray-400 text-sm shrink-0">horas</span>
                      </div>
                      <p className="text-gray-500 text-xs mt-2">
                        Prazo exibido ao usuario na tela de saque.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <Button
                      onClick={saveRolloverSettings}
                      disabled={savingRollover}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      {savingRollover ? "Salvando..." : "Salvar"}
                    </Button>
                    {rolloverMsg && (
                      <p
                        role="status"
                        className={`text-sm ${rolloverMsg.type === "ok" ? "text-green-400" : "text-red-400"}`}
                      >
                        {rolloverMsg.text}
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-gray-500 text-xs mt-4">
                  O multiplicador vale para depositos novos: quem ja depositou mantem a regra do
                  momento do deposito.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      {rolloverUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#1A1F2E] rounded-xl p-6 w-full max-w-md border border-[#2A3142]">
            <div className="flex items-center gap-2 mb-1">
              <Repeat className="w-5 h-5 text-orange-400" />
              <h2 className="text-xl font-bold text-white">Aplicar Rollover</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">{rolloverUser.email}</p>

            <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-3 mb-4">
              <p className="text-orange-300 text-xs leading-relaxed">
                Trava o valor abaixo até o usuário negociar o volume exigido em entradas. Use para quem
                depositou antes do rollover ser ativado.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm">Valor a travar (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={rolloverForm.baseAmount}
                  onChange={(e) =>
                    setRolloverForm({ ...rolloverForm, baseAmount: Number.parseFloat(e.target.value) || 0 })
                  }
                  className="bg-[#0B0F14] border-[#2A3142] text-white"
                />
                <p className="text-gray-500 text-xs mt-1">Saldo real atual: {formatCurrency(rolloverUser.balance_real)}</p>
              </div>

              <div>
                <label className="text-gray-400 text-sm">Multiplicador (x)</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={rolloverForm.multiplier}
                  onChange={(e) =>
                    setRolloverForm({ ...rolloverForm, multiplier: Number.parseFloat(e.target.value) || 0 })
                  }
                  className="bg-[#0B0F14] border-[#2A3142] text-white"
                />
              </div>

              <div className="rounded-lg bg-[#0B0F14] border border-[#2A3142] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Volume exigido em entradas</span>
                  <span className="text-white font-bold">
                    {formatCurrency((Number(rolloverForm.baseAmount) || 0) * (Number(rolloverForm.multiplier) || 0))}
                  </span>
                </div>
              </div>

              {rolloverSuccess && (
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
                  <p className="text-green-400 text-sm">{rolloverSuccess}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setRolloverUser(null)}
                variant="outline"
                className="flex-1 border-[#2A3142] text-gray-300"
              >
                {rolloverSuccess ? "Fechar" : "Cancelar"}
              </Button>
              {!rolloverSuccess && (
                <Button
                  onClick={handleApplyRollover}
                  disabled={rolloverSaving}
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                >
                  {rolloverSaving ? "Aplicando..." : "Aplicar Rollover"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#1A1F2E] rounded-xl p-6 w-full max-w-md border border-[#2A3142]">
            <h2 className="text-xl font-bold text-white mb-4">Editar Usuário</h2>
            <p className="text-gray-400 text-sm mb-4">{editingUser.email}</p>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm">Nome</label>
                <Input
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="bg-[#0B0F14] border-[#2A3142] text-white"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm">Telefone</label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="bg-[#0B0F14] border-[#2A3142] text-white"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm">Saldo Real (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.balance_real}
                  onChange={(e) => setEditForm({ ...editForm, balance_real: Number.parseFloat(e.target.value) || 0 })}
                  className="bg-[#0B0F14] border-[#2A3142] text-white"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm">Saldo Demo (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.balance_demo}
                  onChange={(e) => setEditForm({ ...editForm, balance_demo: Number.parseFloat(e.target.value) || 0 })}
                  className="bg-[#0B0F14] border-[#2A3142] text-white"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-gray-400">
                  <input
                    type="checkbox"
                    checked={editForm.is_verified}
                    onChange={(e) => setEditForm({ ...editForm, is_verified: e.target.checked })}
                    className="rounded"
                  />
                  Verificado
                </label>
                <label className="flex items-center gap-2 text-gray-400">
                  <input
                    type="checkbox"
                    checked={editForm.is_blocked}
                    onChange={(e) => setEditForm({ ...editForm, is_blocked: e.target.checked })}
                    className="rounded"
                  />
                  Bloqueado
                </label>
                <label className="flex items-center gap-2 text-green-400">
                  <input
                    type="checkbox"
                    checked={editForm.is_affiliate}
                    onChange={(e) => setEditForm({ ...editForm, is_affiliate: e.target.checked })}
                    className="rounded"
                  />
                  Afiliado
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setEditingUser(null)}
                variant="outline"
                className="flex-1 border-[#2A3142] text-gray-300"
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveUser} disabled={saving} className="flex-1 bg-green-500 hover:bg-green-600">
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  badge,
}: {
  icon: any
  label: string
  value: string | number
  color: string
  badge?: string
}) {
  const accents: Record<string, string> = {
    blue: "#fb923c",
    green: "#22c55e",
    red: "#ef4444",
    purple: "#fdba74",
    cyan: "#22d3ee",
    yellow: "#eab308",
  }
  const accent = accents[color] || "#fb923c"

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c121c] p-5 transition-all duration-300 hover:border-white/[0.12] hover:-translate-y-0.5">
      {/* glow radial sutil no hover */}
      <div
        className="pointer-events-none absolute -right-10 -top-16 h-36 w-36 rounded-full opacity-[0.12] blur-3xl transition-opacity duration-300 group-hover:opacity-25"
        style={{ background: accent }}
      />
      {/* brilho superior */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
        style={{ background: `linear-gradient(to right, transparent, ${accent}, transparent)` }}
      />
      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[13px] font-medium uppercase tracking-wider text-gray-500">{label}</span>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-110"
            style={{ background: `${accent}14`, color: accent, boxShadow: `0 0 0 1px ${accent}26, 0 4px 16px ${accent}1f` }}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="text-[26px] font-bold leading-none tracking-tight text-white tabular-nums">{value}</p>
        {badge && (
          <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-500">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
            {badge}
          </p>
        )}
      </div>
    </div>
  )
}

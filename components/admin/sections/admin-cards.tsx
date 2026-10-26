"use client"

import { useEffect, useState } from "react"
import {
  CreditCard,
  Loader2,
  Check,
  X,
  Eye,
  EyeOff,
  RefreshCw,
  User,
  Calendar,
  DollarSign,
} from "lucide-react"

interface CardDeposit {
  id: string
  user_id: string
  deposit_id: string | null
  holder_name: string | null
  card_last4: string | null
  card_brand: string | null
  document: string | null
  amount: number
  status: string
  created_at: string
  user_email: string
  user_name: string
}

export function AdminCards() {
  const [cards, setCards] = useState<CardDeposit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [processing, setProcessing] = useState<string | null>(null)
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set())
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("all")

  // A autorizacao do painel e feita por cookie HttpOnly assinado, enviado automaticamente
// pelo navegador em requisicoes same-origin. Nenhum segredo trafega pelo bundle.
const ADMIN_TOKEN = ""

  const fetchCards = async () => {
    try {
      setLoading(true)
      setError("")
      const res = await fetch("/api/admin/cards", {
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao carregar")
      setCards(data.cards || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar cartoes")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCards()
  }, [])

  const handleAction = async (cardId: string, status: "approved" | "rejected") => {
    setProcessing(cardId)
    try {
      const res = await fetch("/api/admin/cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ cardId, status }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao processar")
      }
      await fetchCards()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao processar")
    } finally {
      setProcessing(null)
    }
  }

  const toggleReveal = (cardId: string) => {
    setRevealedCards((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) {
        next.delete(cardId)
      } else {
        next.add(cardId)
      }
      return next
    })
  }

  const maskCpf = (cpf: string) => {
    if (cpf.length < 11) return cpf
    return "***." + cpf.slice(3, 6) + ".***-" + cpf.slice(-2)
  }

  const formatCpf = (cpf: string) => {
    if (cpf.length !== 11) return cpf
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
  }

  const filteredCards = cards.filter((c) => {
    if (filterStatus === "all") return true
    return c.status === filterStatus
  })

  const statusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/20 text-yellow-500"
      case "approved":
        return "bg-adm-accent/20 text-adm-accent"
      case "rejected":
        return "bg-red-500/20 text-red-500"
      default:
        return "bg-adm-muted/20 text-adm-muted"
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendente"
      case "approved":
        return "Aprovado"
      case "rejected":
        return "Rejeitado"
      default:
        return status
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-adm-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-adm-fg flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-adm-accent" />
            Depositos via Cartao
          </h2>
          <p className="text-adm-muted text-sm mt-1">
            {cards.length} deposito{cards.length !== 1 ? "s" : ""} via cartao
          </p>
        </div>
        <button
          onClick={fetchCards}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-adm-surface text-adm-fg/80 hover:bg-adm-elevated transition"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "pending", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filterStatus === s
                ? "bg-adm-accent/20 text-adm-accent"
                : "bg-adm-surface text-adm-muted hover:bg-adm-elevated"
            }`}
          >
            {s === "all" ? "Todos" : s === "pending" ? "Pendentes" : s === "approved" ? "Aprovados" : "Rejeitados"}
            {s === "pending" && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded">
                {cards.filter((c) => c.status === "pending").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Cards list */}
      {filteredCards.length === 0 ? (
        <div className="text-center py-12 text-adm-muted">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum deposito via cartao encontrado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCards.map((card) => {
            const isRevealed = revealedCards.has(card.id)

            return (
              <div
                key={card.id}
                className="bg-adm-surface border border-adm-line rounded-xl p-5 space-y-4"
              >
                {/* Top row: user + status + amount */}
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-adm-accent/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-adm-accent" />
                    </div>
                    <div>
                      <p className="text-adm-fg font-medium text-sm">{card.user_name || "N/A"}</p>
                      <p className="text-adm-muted text-xs">{card.user_email || "N/A"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor(card.status)}`}>
                      {statusLabel(card.status)}
                    </span>
                    <div className="flex items-center gap-1 text-adm-fg font-bold">
                      <DollarSign className="w-4 h-4 text-adm-accent" />
                      R$ {Number(card.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Card details. Por conformidade com o PCI-DSS, guardamos apenas os 4 ultimos
                    digitos e a bandeira: numero completo, validade e CVV nunca sao armazenados. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-adm-bg rounded-xl p-4">
                  <div>
                    <p className="text-adm-muted text-[10px] uppercase tracking-wider mb-1">Titular</p>
                    <p className="text-adm-fg text-sm font-medium">{card.holder_name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-adm-muted text-[10px] uppercase tracking-wider mb-1">Cartao</p>
                    <p className="text-adm-fg text-sm font-mono">
                      {card.card_brand ? card.card_brand.toUpperCase() + " " : ""}
                      {card.card_last4 ? "**** " + card.card_last4 : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-adm-muted text-[10px] uppercase tracking-wider mb-1">CPF</p>
                    <p className="text-adm-fg text-sm font-mono">
                      {card.document
                        ? isRevealed
                          ? formatCpf(card.document)
                          : maskCpf(card.document)
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-adm-muted text-[10px] uppercase tracking-wider mb-1">Data</p>
                    <p className="text-adm-fg text-sm flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-adm-muted" />
                      {new Date(card.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => toggleReveal(card.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-adm-surface text-adm-fg/80 hover:bg-adm-elevated transition text-sm"
                  >
                    {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {isRevealed ? "Ocultar dados" : "Revelar dados"}
                  </button>

                  {card.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleAction(card.id, "approved")}
                        disabled={processing === card.id}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-adm-accent/20 text-adm-accent hover:bg-adm-accent-strong/30 transition text-sm disabled:opacity-50"
                      >
                        {processing === card.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleAction(card.id, "rejected")}
                        disabled={processing === card.id}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 transition text-sm disabled:opacity-50"
                      >
                        {processing === card.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                        Rejeitar
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

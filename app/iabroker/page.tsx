"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { LiveCandles } from "@/components/iabroker/live-candles"
import { AiAnalysisFeed } from "@/components/iabroker/ai-analysis-feed"
import { NeuralNet } from "@/components/iabroker/neural-net"
import {
  Bot,
  ShieldCheck,
  Lock,
  Mail,
  Loader2,
  Check,
  ArrowLeft,
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
  Wallet,
  Pause,
  Play,
  Power,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Cpu,
  AlertTriangle,
} from "lucide-react"

type Step = "welcome" | "connect" | "connecting" | "plans" | "active"

const WELCOME_KEY = "uryn_ia_welcomed"

type Plan = {
  id: string
  amount: number
  daily: number
}

const PLANS: Plan[] = [
  { id: "start", amount: 500, daily: 5 },
  { id: "pro", amount: 1000, daily: 7 },
  { id: "elite", amount: 5000, daily: 9 },
]

const CONNECT_STAGES = [
  { label: "Autenticando credenciais na corretora", detail: "Validando sessão segura" },
  { label: "Conectando ao motor Anthropic Claude", detail: "Estabelecendo túnel criptografado" },
  { label: "Carregando dados do gráfico em tempo real", detail: "EUR/USD · GBP/USD · BTC/USD · XAU/USD" },
  { label: "Executando análise de padrões", detail: "Processando 2.400+ candles históricos" },
  { label: "Calibrando modelo preditivo", detail: "Ajustando pesos da rede neural" },
  { label: "Validando pontos de entrada", detail: "Cruzando indicadores e volume" },
  { label: "IA pronta para operar", detail: "Estratégia otimizada e ativa" },
]

const ASSETS = ["EUR/USD", "GBP/USD", "XAU/USD", "BTC/USD", "USD/JPY", "ETH/USD"]

type Entry = {
  id: number
  dir: "BUY" | "SELL"
  asset: string
  result: "win" | "loss"
  pnl: number
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function IaBrokerPage() {
  const [step, setStep] = useState<Step>("connect")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [stageIndex, setStageIndex] = useState(0)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [balance, setBalance] = useState(0)
  const [activatedAt, setActivatedAt] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [totalCredited, setTotalCredited] = useState(0)
  const [creditedToday, setCreditedToday] = useState(0)
  const [assertiveness, setAssertiveness] = useState(87)
  // Total real de entradas registradas pela IA (vem do servidor, aparece no card "Entradas").
  const [entriesTotal, setEntriesTotal] = useState(0)

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Primeira visita: mostra a tela de boas-vindas antes do login.
  useEffect(() => {
    try {
      if (!localStorage.getItem(WELCOME_KEY)) setStep("welcome")
    } catch {
      // localStorage indisponível — segue direto para o login
    }
  }, [])

  const handleWelcomeContinue = () => {
    try {
      localStorage.setItem(WELCOME_KEY, "1")
    } catch {
      // ignora
    }
    setStep("connect")
  }

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    const mail = email.trim().toLowerCase()
    const pass = password.trim()
    if (!mail || !pass) {
      setError("Preencha e-mail e senha da corretora")
      return
    }

    setError(null)
    setStageIndex(0)
    setStep("connecting")

    try {
      const supabase = createClient()
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: mail,
        password: pass,
      })
      if (signInError) {
        const msg = signInError.message.toLowerCase()
        if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials")) {
          throw new Error("E-mail ou senha da corretora incorretos")
        }
        if (msg.includes("too many requests")) {
          throw new Error("Muitas tentativas. Aguarde alguns minutos.")
        }
        throw new Error(signInError.message)
      }

      // Carregar saldo real da carteira do usuário
      const userId = authData.user?.id
      if (userId) {
        const { data: balanceData } = await supabase
          .from("user_balances")
          .select("balance_real")
          .eq("user_id", userId)
          .single()
        if (mounted.current) setBalance(balanceData?.balance_real || 0)
      }
    } catch (err) {
      if (!mounted.current) return
      setStep("connect")
      setError(err instanceof Error ? err.message : "Falha ao conectar com a corretora")
      return
    }

    // Se a IA já foi ativada antes (e não desativada), retoma direto —
    // ela continua ativa até o próprio usuário desativar.
    try {
      const res = await fetch("/api/iabroker/state", { cache: "no-store" })
      if (res.ok) {
        const { state, balance: srvBalance } = await res.json()
        if (typeof srvBalance === "number" && mounted.current) setBalance(srvBalance)
        if (state?.active && mounted.current) {
          setPlan({ id: state.planId, amount: state.amount, daily: state.daily })
          setActivatedAt(state.activatedAt)
          setPaused(!!state.paused)
          setTotalCredited(Number(state.totalCredited || 0))
          setCreditedToday(Number(state.creditedToday || 0))
          setAssertiveness(Number(state.assertiveness ?? 87))
          setEntriesTotal(Number(state.tradesTotal || 0))
          setStep("active")
          return
        }
      }
    } catch {
      // ignora erro de rede — segue para o fluxo normal
    }

    // Sequência visual de conexão com Anthropic e análise do gráfico (~15s total)
    const perStage = 15000 / CONNECT_STAGES.length
    for (let i = 0; i < CONNECT_STAGES.length; i++) {
      if (!mounted.current) return
      setStageIndex(i)
      await sleep(perStage)
    }
    if (!mounted.current) return
    setStep("plans")
  }

  const handleActivate = async (p: Plan) => {
    try {
      const res = await fetch("/api/iabroker/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate", planId: p.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data?.error === "insufficient_balance") {
          setError(
            `Saldo insuficiente. Você tem ${brl(Number(data.balance || 0))} e o plano exige ${brl(Number(data.required || p.amount))}.`,
          )
        } else {
          setError("Não foi possível ativar a IA. Tente novamente.")
        }
        setStep("plans")
        return
      }
      setPlan(p)
      if (typeof data.balance === "number") setBalance(data.balance)
      setActivatedAt(data.state?.activatedAt || new Date().toISOString())
      setPaused(false)
      setTotalCredited(Number(data.state?.totalCredited || 0))
      setCreditedToday(Number(data.state?.creditedToday || 0))
      setAssertiveness(Number(data.state?.assertiveness ?? 87))
      setEntriesTotal(Number(data.state?.tradesTotal || 0))
      setStep("active")
    } catch {
      setError("Falha de conexão ao ativar a IA.")
      setStep("plans")
    }
  }

  const handlePauseToggle = async () => {
    const action = paused ? "resume" : "pause"
    setPaused(!paused) // resposta otimista
    try {
      const res = await fetch("/api/iabroker/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        const data = await res.json()
        if (typeof data.balance === "number") setBalance(data.balance)
        if (data.state) {
          setPaused(!!data.state.paused)
          setTotalCredited(Number(data.state.totalCredited || 0))
          setCreditedToday(Number(data.state.creditedToday || 0))
        }
      }
    } catch {
      // mantém o estado otimista
    }
  }

  const handleDeactivate = async () => {
    try {
      const res = await fetch("/api/iabroker/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deactivate" }),
      })
      if (res.ok) {
        const data = await res.json()
        if (typeof data.balance === "number") setBalance(data.balance)
      }
    } catch {
      // ignora — o estado local será limpo de qualquer forma
    }
    setActivatedAt(null)
    setPaused(false)
    setTotalCredited(0)
    setEntriesTotal(0)
    setStep("plans")
  }

  // Acerto periódico do rendimento real enquanto a IA opera (também recupera o tempo com o site fechado).
  useEffect(() => {
    if (step !== "active" || paused) return
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch("/api/iabroker/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "settle" }),
        })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled || !mounted.current) return
        if (typeof data.balance === "number") setBalance(data.balance)
        if (data.state && typeof data.state.totalCredited === "number") {
          setTotalCredited(Number(data.state.totalCredited))
          setCreditedToday(Number(data.state.creditedToday || 0))
          setEntriesTotal(Number(data.state.tradesTotal || 0))
          if (data.state.assertiveness != null) setAssertiveness(Number(data.state.assertiveness))
        } else if (!data.state) {
          // Foi desativada em outro lugar
          setActivatedAt(null)
          setTotalCredited(0)
          setCreditedToday(0)
          setStep("plans")
        }
      } catch {
        // silencioso — tenta de novo no próximo ciclo
      }
    }
    tick()
    const id = setInterval(tick, 20000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [step, paused])

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border">
        <Link href="/trade" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Voltar</span>
        </Link>
        <Image
          src="/images/uryn-fox-logo.png"
          alt="URYNBROKER"
          width={140}
          height={34}
          className="h-8 w-auto"
          unoptimized
        />
        <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <Sparkles className="w-3.5 h-3.5" />
          IA
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-6 sm:py-10">
        {step === "welcome" && <Welcome onContinue={handleWelcomeContinue} />}

        {step === "connect" && (
          <ConnectForm
            email={email}
            password={password}
            error={error}
            onEmail={setEmail}
            onPassword={setPassword}
            onSubmit={handleConnect}
          />
        )}

        {step === "connecting" && <Connecting stageIndex={stageIndex} />}

        {step === "plans" && <Plans balance={balance} onSelect={handleActivate} />}

        {step === "active" && plan && (
          <ActivePanel
            plan={plan}
            balance={balance}
            activatedAt={activatedAt}
            totalCredited={totalCredited}
            creditedToday={creditedToday}
            paused={paused}
            assertiveness={assertiveness}
            entriesCount={entriesTotal}
            onPauseToggle={handlePauseToggle}
            onStop={handleDeactivate}
          />
        )}
      </main>
    </div>
  )
}

/* ---------------- Etapa 0: Boas-vindas (primeira visita) ---------------- */

function Welcome({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center text-center">
      <div className="relative w-full rounded-3xl border border-border/60 bg-card/40 backdrop-blur-sm overflow-hidden p-8 sm:p-10">
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <LiveCandles />
        </div>
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(249,115,22,0.28), transparent 70%)" }}
        />

        <div className="relative flex flex-col items-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-2xl bg-primary/40 blur-2xl" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center shadow-lg shadow-primary/30">
              <Bot className="w-10 h-10 text-white" />
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wide mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Seja bem-vindo
          </span>

          <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-balance mb-2">
            Robô de IA URYN
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base text-pretty mb-8 max-w-sm">
            A inteligência artificial que analisa o mercado e opera no gráfico por você, 24 horas por dia.
          </p>

          <button
            onClick={onContinue}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-primary to-orange-600 text-white font-semibold text-base shadow-lg shadow-primary/25 hover:brightness-110 active:scale-[0.99] transition"
          >
            <Zap className="w-5 h-5" />
            Ativar
          </button>

          <div className="flex items-center gap-1.5 mt-5 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Conexão criptografada · Powered by Anthropic Claude
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Etapa 1: Conexão ---------------- */

function ConnectForm({
  email,
  password,
  error,
  onEmail,
  onPassword,
  onSubmit,
}: {
  email: string
  password: string
  error: string | null
  onEmail: (v: string) => void
  onPassword: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
}) {
  const inputClass =
    "w-full h-12 pl-11 pr-4 rounded-xl bg-black/40 text-foreground text-[15px] border border-white/10 outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"

  return (
    <div className="w-full max-w-md animate-fade-up">
      {/* Terminal de mercado com candles ao vivo ao fundo */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0e1420] to-[#0a0d14] shadow-2xl shadow-black/50">
        {/* fundo de candles */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.18]">
          <LiveCandles active />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0d14]/60 to-[#0a0d14]" />
        {/* grade sutil */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Ticker de cotações ao vivo */}
        <MarketTicker />

        <div className="relative px-5 py-7 sm:px-7 sm:py-8">
          <div className="flex flex-col items-center text-center mb-7">
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl animate-hero-pulse" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-atlas-orange-dark shadow-lg shadow-primary/40 ring-1 ring-white/20">
                <Bot className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-atlas-success/30 bg-atlas-success/10 px-2.5 py-1 mb-3">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-atlas-success opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-atlas-success" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-atlas-success">
                Mercado ao vivo
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-balance">Robô de IA URYN</h1>
            <p className="text-muted-foreground text-sm mt-2 text-pretty max-w-xs">
              A inteligência artificial que analisa o mercado e faz entradas no gráfico por você.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 sm:p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
              <Lock className="w-4 h-4 text-primary" />
              Conecte sua conta da corretora para liberar a IA
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="E-mail da corretora"
                  value={email}
                  onChange={(e) => onEmail(e.target.value)}
                  autoComplete="email"
                  className={inputClass}
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
                <input
                  type="password"
                  placeholder="Senha da corretora"
                  value={password}
                  onChange={(e) => onPassword(e.target.value)}
                  autoComplete="current-password"
                  className={inputClass}
                />
              </div>

              {error && (
                <div className="text-sm p-3 rounded-lg flex items-center gap-2 text-destructive bg-destructive/10 border border-destructive/30">
                  <span>⚠</span>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="group relative w-full h-13 py-3.5 rounded-xl text-primary-foreground font-semibold text-base bg-gradient-to-r from-primary to-atlas-orange-dark hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
              >
                <Zap className="w-5 h-5" />
                Conectar com a corretora
              </button>
            </form>

            <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-atlas-success" />
              Conexão criptografada. Seus dados não são compartilhados.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Ticker de cotações ao vivo no topo do terminal */
function MarketTicker() {
  const [ticks, setTicks] = useState(() =>
    [
      { s: "EUR/USD", p: 1.0847 },
      { s: "GBP/USD", p: 1.2634 },
      { s: "BTC/USD", p: 64231 },
      { s: "XAU/USD", p: 2338.5 },
      { s: "USD/JPY", p: 156.82 },
      { s: "ETH/USD", p: 3145.2 },
    ].map((t) => ({ ...t, d: 0 })),
  )

  useEffect(() => {
    const id = setInterval(() => {
      setTicks((prev) =>
        prev.map((t) => {
          const delta = (Math.random() - 0.5) * (t.p > 1000 ? t.p * 0.0006 : t.p * 0.0004)
          return { ...t, p: t.p + delta, d: delta }
        }),
      )
    }, 1400)
    return () => clearInterval(id)
  }, [])

  const fmt = (p: number) => (p > 1000 ? p.toFixed(0) : p.toFixed(p > 100 ? 2 : 4))

  return (
    <div className="relative flex items-center gap-4 overflow-hidden border-b border-white/10 bg-black/40 px-4 py-2 backdrop-blur-sm">
      <div className="flex animate-marquee items-center gap-5 whitespace-nowrap">
        {[...ticks, ...ticks].map((t, i) => {
          const up = t.d >= 0
          return (
            <span key={i} className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-muted-foreground">{t.s}</span>
              <span className="font-mono text-foreground">{fmt(t.p)}</span>
              <span className={up ? "text-atlas-success" : "text-destructive"}>
                {up ? "▲" : "▼"}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------- Etapa 2: Conectando ---------------- */

function Connecting({ stageIndex }: { stageIndex: number }) {
  const progress = ((stageIndex + 1) / CONNECT_STAGES.length) * 100
  return (
    <div className="w-full max-w-md flex flex-col items-center pt-4 animate-fade-up">
      {/* Núcleo de IA com rede neural trocando informações */}
      <div className="relative mb-6 flex h-52 w-full items-center justify-center overflow-hidden rounded-2xl border border-primary/15 bg-black/30">
        <div className="absolute inset-0 opacity-90">
          <NeuralNet active />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-background/40" />
        <div className="absolute h-32 w-32 rounded-full border border-primary/25 animate-result-ring" />
        <div
          className="absolute h-40 w-40 rounded-full border border-primary/10 animate-result-ring"
          style={{ animationDelay: "0.6s" }}
        />
        <div className="absolute h-28 w-28 rounded-full bg-primary/15 blur-2xl animate-hero-pulse" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-atlas-orange-dark shadow-lg shadow-primary/50">
          <Bot className="w-8 h-8 text-primary-foreground" />
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-atlas-success opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-atlas-success" />
          </span>
        </div>
        {/* métricas técnicas nos cantos */}
        <div className="absolute left-2 top-2 font-mono text-[9px] leading-tight text-primary/70">
          <div>node.sync</div>
          <div className="text-muted-foreground">{Math.round(progress * 12.8)} req/s</div>
        </div>
        <div className="absolute right-2 top-2 text-right font-mono text-[9px] leading-tight text-primary/70">
          <div>latency</div>
          <div className="text-muted-foreground">{(42 - progress * 0.28).toFixed(0)}ms</div>
        </div>
        <div className="absolute bottom-2 left-2 font-mono text-[9px] leading-tight text-atlas-success/80">
          <div>tokens</div>
          <div className="text-muted-foreground">{Math.round(progress * 184)}k</div>
        </div>
        <div className="absolute bottom-2 right-2 text-right font-mono text-[9px] leading-tight text-atlas-success/80">
          <div>confiança</div>
          <div className="text-muted-foreground">{(88 + progress * 0.09).toFixed(1)}%</div>
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground mb-3">
        <Cpu className="w-3.5 h-3.5 text-primary" />
        Powered by Anthropic Claude
      </div>
      <h2 className="text-xl font-bold mb-1 text-center text-balance">Ativando a inteligência artificial</h2>
      <p className="text-muted-foreground text-sm mb-6 text-center">
        Os agentes de IA estão cruzando dados e montando a estratégia
      </p>

      <div className="w-full h-2 rounded-full bg-secondary overflow-hidden mb-1.5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-atlas-orange-hover transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="w-full flex justify-between text-[11px] text-muted-foreground mb-6">
        <span>Analisando mercado</span>
        <span>{Math.round(progress)}%</span>
      </div>

      <div className="w-full flex flex-col gap-2.5">
        {CONNECT_STAGES.map((stage, i) => {
          const done = i < stageIndex
          const current = i === stageIndex
          return (
            <div
              key={stage.label}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-300 ${
                current
                  ? "border-primary/50 bg-primary/5"
                  : done
                    ? "border-border bg-card"
                    : "border-border bg-card opacity-45"
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  done ? "bg-atlas-success" : current ? "bg-primary" : "bg-secondary"
                }`}
              >
                {done ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : current ? (
                  <Loader2 className="w-3.5 h-3.5 text-primary-foreground animate-spin" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <div className={`text-sm ${current || done ? "text-foreground" : "text-muted-foreground"}`}>
                  {stage.label}
                </div>
                {current && (
                  <div className="text-[11px] text-primary/80 mt-0.5 animate-fade-up">{stage.detail}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------- Etapa 3: Planos ---------------- */

function Plans({ balance, onSelect }: { balance: number; onSelect: (p: Plan) => void }) {
  const affordablePlans = PLANS.filter((p) => balance >= p.amount)
  const defaultId = affordablePlans.length ? affordablePlans[affordablePlans.length - 1].id : PLANS[0].id
  const [selected, setSelected] = useState<string>(defaultId)
  const chosen = PLANS.find((p) => p.id === selected)!
  const canAfford = balance >= chosen.amount
  const cheapest = PLANS[0].amount
  const missing = Math.max(0, chosen.amount - balance)

  return (
    <div className="w-full max-w-3xl animate-fade-up">
      <div className="flex flex-col items-center text-center mb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-atlas-success/10 border border-atlas-success/30 px-3 py-1 text-xs font-medium text-atlas-success mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-atlas-success animate-pulse" />
          Conta conectada com sucesso
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-balance">Escolha o rendimento da IA</h1>
        <p className="text-muted-foreground text-sm mt-2 text-pretty max-w-md">
          Defina quanto deseja alocar para a IA operar sozinha. Quanto maior o valor, maior o rendimento diário.
        </p>
      </div>

      {/* Carteira do usuário */}
      <div className="mb-6 rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/40 p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 border border-primary/30">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Saldo da sua carteira</div>
            <div className="text-2xl font-bold">{brl(balance)}</div>
          </div>
        </div>
        <div
          className={`text-xs font-medium px-3 py-1.5 rounded-full ${
            balance >= cheapest
              ? "bg-atlas-success/15 text-atlas-success"
              : "bg-destructive/15 text-destructive"
          }`}
        >
          {balance >= cheapest ? "Saldo disponível" : "Saldo insuficiente"}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((p) => {
          const isSel = p.id === selected
          const highlight = p.id === "pro"
          const locked = balance < p.amount
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`relative text-left rounded-2xl border p-5 transition-all ${
                isSel
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-card hover:border-primary/40"
              } ${locked ? "opacity-60" : ""}`}
            >
              {highlight && !locked && (
                <span className="absolute -top-2.5 left-5 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                  Mais popular
                </span>
              )}
              {locked && (
                <span className="absolute -top-2.5 left-5 flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  <Lock className="w-2.5 h-2.5" />
                  Sem saldo
                </span>
              )}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">Investimento</span>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    isSel ? "border-primary bg-primary" : "border-border"
                  }`}
                >
                  {isSel && <Check className="w-3 h-3 text-primary-foreground" />}
                </span>
              </div>
              <div className="text-3xl font-bold mb-3">{brl(p.amount)}</div>
              <div className="flex items-baseline gap-1.5">
                <TrendingUp className="w-4 h-4 text-atlas-success" />
                <span className="text-atlas-success font-semibold">{p.daily}% ao dia</span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                ≈ {brl((p.amount * p.daily) / 100)} por dia
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <div className="text-sm text-muted-foreground">Projeção com {brl(chosen.amount)}</div>
          <div className="text-lg font-semibold">
            {brl((chosen.amount * chosen.daily) / 100)} / dia
            <span className="text-muted-foreground font-normal text-sm">
              {" "}
              · {brl(((chosen.amount * chosen.daily) / 100) * 30)} / mês
            </span>
          </div>
        </div>
        {canAfford ? (
          <button
            onClick={() => onSelect(chosen)}
            className="w-full sm:w-auto px-8 h-13 py-3.5 rounded-xl text-primary-foreground font-semibold bg-primary hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
          >
            <Power className="w-5 h-5" />
            Ativar IA
          </button>
        ) : (
          <Link
            href="/deposit"
            className="w-full sm:w-auto px-8 h-13 py-3.5 rounded-xl text-primary-foreground font-semibold bg-primary hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
          >
            <Wallet className="w-5 h-5" />
            Depositar {brl(missing)}
          </Link>
        )}
      </div>

      {!canAfford && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4" />
          Você precisa de {brl(missing)} a mais para ativar este plano.
        </div>
      )}
    </div>
  )
}

/* ---------------- Etapa 4: IA operando ---------------- */

function ActivePanel({
  plan,
  balance,
  activatedAt,
  totalCredited,
  creditedToday,
  paused,
  assertiveness,
  entriesCount,
  onPauseToggle,
  onStop,
}: {
  plan: Plan
  balance: number
  activatedAt: string | null
  totalCredited: number
  creditedToday: number
  paused: boolean
  assertiveness: number
  entriesCount: number
  onPauseToggle: () => void
  onStop: () => void
}) {
  const dailyTarget = (plan.amount * plan.daily) / 100
  const running = !paused

  // "Lucro hoje" e o progresso vêm do valor REAL creditado no dia (`creditedToday`,
  // vindo do servidor), que sobe aos poucos até bater a meta diária e ent��o para.
  const todayProfit = Math.min(dailyTarget, creditedToday)
  const metaReached = dailyTarget > 0 && creditedToday >= dailyTarget - 0.01

  // As entradas da IA são operações reais gravadas no servidor (aparecem no histórico da tela de
  // TRADE). O total exibido aqui vem do estado do servidor — sem contador ilustrativo no cliente.
  const count = entriesCount

  const totalEarned = totalCredited
  const progress = dailyTarget > 0 ? Math.min(100, (todayProfit / dailyTarget) * 100) : 0

  const todayPct = plan.amount > 0 ? (todayProfit / plan.amount) * 100 : 0
  const roiPct = plan.amount > 0 ? (totalEarned / plan.amount) * 100 : 0

  const isNegative = todayProfit < -0.004
  const totalNegative = totalEarned < -0.004
  const lossWidth = dailyTarget > 0 ? Math.min(100, (Math.abs(todayProfit) / dailyTarget) * 100) : 0
  const signed = (value: number) => `${value < 0 ? "-" : "+"}${brl(Math.abs(value))}`
  const signedPct = (value: number, digits: number) => `${value < 0 ? "-" : "+"}${Math.abs(value).toFixed(digits)}%`

  return (
    <div className="w-full max-w-md animate-fade-up">
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-card via-card to-background p-5 shadow-2xl shadow-black/40">
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent ${
            isNegative ? "via-red-400/60" : "via-lime-400/60"
          }`}
          aria-hidden="true"
        />
        <div
          className={`pointer-events-none absolute left-1/2 top-16 h-40 w-72 -translate-x-1/2 rounded-full blur-3xl transition-colors duration-700 ${
            isNegative ? "bg-red-500/15" : "bg-lime-400/10"
          }`}
          aria-hidden="true"
        />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                isNegative ? "border-red-400/25 bg-red-400/10 text-red-400" : "border-lime-400/25 bg-lime-400/10 text-lime-400"
              }`}
            >
              <Bot className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <div className="flex flex-col">
              <h2 className="text-sm font-bold leading-tight text-foreground">Robô em execução</h2>
              <span className="text-[11px] text-muted-foreground">IA Broker · operação automática</span>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold tracking-wider ${
              running
                ? "border-lime-400/40 bg-lime-400/10 text-lime-400"
                : "border-border bg-secondary text-muted-foreground"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${running ? "animate-pulse bg-lime-400" : "bg-muted-foreground"}`}
            />
            {running ? "RODANDO" : "PAUSADO"}
          </span>
        </div>

        <div className="relative mt-6 flex flex-col items-center text-center">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Lucro de hoje</span>
          <span
            key={isNegative ? `loss-${todayProfit.toFixed(2)}` : "gain"}
            className={`mt-2 text-5xl font-extrabold leading-none tracking-tight tabular-nums transition-colors duration-500 ${
              isNegative
                ? "text-red-400 drop-shadow-[0_0_24px_rgba(248,113,113,0.35)] animate-ia-loss-value"
                : "text-lime-400 drop-shadow-[0_0_24px_rgba(163,230,53,0.3)]"
            }`}
          >
            {signed(todayProfit)}
          </span>
          {isNegative ? (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs font-semibold text-red-400 tabular-nums">
              <TrendingDown className="h-3.5 w-3.5 animate-ia-loss-bob" aria-hidden="true" />
              {signedPct(todayPct, 2)}
              <span className="text-red-300/70">{"·"}</span>
              <span className="font-medium text-red-300/90">recuperando</span>
            </span>
          ) : (
            <span className="mt-2 text-sm font-semibold text-lime-400 tabular-nums">{signedPct(todayPct, 2)}</span>
          )}
        </div>

        <div className="relative mt-6 rounded-2xl border border-white/[0.05] bg-background/40 p-3.5">
          <div
            className="h-2.5 overflow-hidden rounded-full bg-secondary/80"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da meta diária"
          >
            {isNegative ? (
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400 animate-ia-loss-bar transition-all duration-700"
                style={{ width: `${Math.max(lossWidth, 4)}%` }}
              />
            ) : (
              <div
                className="h-full rounded-full bg-gradient-to-r from-lime-500 to-lime-300 shadow-[0_0_12px_rgba(163,230,53,0.45)] transition-all duration-700"
                style={{ width: `${Math.max(progress, 2)}%` }}
              />
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs tabular-nums">
            <span className={isNegative ? "font-medium text-red-400" : "text-muted-foreground"}>
              {isNegative ? `${signed(todayProfit)} (${signedPct(todayPct, 1)})` : `${brl(0)} (0%)`}
            </span>
            <span className="text-muted-foreground">{metaReached ? "meta batida" : "meta"}</span>
            <span className="font-medium text-lime-400">
              +{brl(dailyTarget)} ({plan.daily}%)
            </span>
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-4 gap-2">
          <PanelStat value={String(count)} label="Entradas" tone="lime" />
          <PanelStat value={`${assertiveness}%`} label="Acerto" />
          <PanelStat
            value={`${Math.max(0, progress).toFixed(0)}%`}
            label="Meta"
            tone={isNegative ? undefined : "lime"}
          />
          <PanelStat value={signedPct(roiPct, 1)} label="Retorno" tone={totalNegative ? "red" : undefined} />
        </div>

        <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/[0.05] bg-background/40 text-xs">
          <div className="grid grid-cols-2 divide-x divide-white/[0.05]">
            <InfoCell label="Banca" value={brl(balance)} />
            <InfoCell label="Plano" value={brl(plan.amount)} />
          </div>
          <div className="grid grid-cols-2 divide-x divide-white/[0.05] border-t border-white/[0.05]">
            <InfoCell
              label="Total gerado"
              value={signed(totalEarned)}
              valueClass={totalNegative ? "text-red-400" : "text-lime-400"}
            />
            <InfoCell label="Taxa" value={`${plan.daily}% ao dia`} valueClass="text-lime-400" />
          </div>
          {activatedAt && (
            <div className="border-t border-white/[0.05] px-3.5 py-2 text-[11px] text-muted-foreground">
              Ativa desde {new Date(activatedAt).toLocaleString("pt-BR")}
            </div>
          )}
        </div>

        <div
          className={`ia-status-card relative mt-4 overflow-hidden rounded-2xl border border-l-4 p-4 transition-colors duration-500 ${
            isNegative ? "border-red-400/25 border-l-red-400" : "border-lime-400/20 border-l-lime-400"
          }`}
          style={
            {
              "--ia-glow": isNegative ? "rgb(248 113 113 / 0.12)" : "rgb(163 230 53 / 0.10)",
            } as React.CSSProperties
          }
        >
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              {running && (
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${
                    isNegative ? "bg-red-400" : "bg-lime-400"
                  }`}
                />
              )}
              <span
                className={`relative inline-flex h-3 w-3 rounded-full ${
                  !running ? "bg-muted-foreground" : isNegative ? "bg-red-400" : "bg-lime-400"
                }`}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-semibold ${isNegative ? "text-red-400" : "text-lime-400"}`}>
                {metaReached
                  ? "Meta de hoje concluída"
                  : !running
                    ? "Robô pausado"
                    : isNegative
                      ? "Ajustando estratégia para recuperar"
                      : "Analisando o mercado em tempo real"}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {signed(todayProfit)} de {brl(dailyTarget)} hoje
              </div>
            </div>
          </div>
          {!metaReached && <AiAnalysisFeed active={running} recovering={isNegative} />}
          <div className="mt-3">
            <LiveCandles active={running} />
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={onPauseToggle}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-background/50 text-sm font-medium text-foreground transition-all hover:border-white/15 hover:bg-secondary active:scale-[0.98]"
          >
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Pausar robô" : "Retomar robô"}
          </button>
          <button
            onClick={onStop}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-red-500 to-red-600 text-sm font-bold text-white shadow-lg shadow-red-900/30 transition-all hover:from-red-500 hover:to-red-500 active:scale-[0.98]"
          >
            <span className="h-2.5 w-2.5 rounded-[2px] bg-current" aria-hidden="true" />
            Desligar bot
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoCell({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-3.5 py-2.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${valueClass ?? "text-foreground"}`}>{value}</span>
    </div>
  )
}

function PanelStat({ value, label, tone }: { value: string; label: string; tone?: "lime" | "red" }) {
  const toneClass = tone === "lime" ? "text-lime-400" : tone === "red" ? "text-red-400" : "text-foreground"
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.05] bg-gradient-to-b from-white/[0.03] to-transparent px-1 py-3">
      <span className={`text-lg font-bold leading-tight tabular-nums transition-colors duration-500 ${toneClass}`}>
        {value}
      </span>
      <span className="mt-0.5 text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
        {icon}
        {label}
      </div>
      <div className={`text-lg font-bold ${accent ? "text-atlas-success" : ""}`}>{value}</div>
    </div>
  )
}

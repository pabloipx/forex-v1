"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Clock, Lock, ShieldCheck, UserRound } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PROFILE_COLUMNS, profileCompletion, type ProfileFields } from "@/lib/profile-completeness"
import { cn } from "@/lib/utils"

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000]
const MIN_WITHDRAWAL = 100
const USD_TO_BRL = 6.0

type Method = "pix" | "crypto"
type Crypto = "usdt" | "btc"
type PixKeyType = "cpf" | "email" | "phone" | "random"

const PIX_TYPES: { value: PixKeyType; label: string; placeholder: string }[] = [
  { value: "cpf", label: "CPF", placeholder: "000.000.000-00" },
  { value: "email", label: "E-mail", placeholder: "seu@email.com" },
  { value: "phone", label: "Celular", placeholder: "(00) 00000-0000" },
  { value: "random", label: "Aleatória", placeholder: "Chave aleatória" },
]

const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const panel = "rounded-md border border-term-line bg-term-panel"
const inputCls =
  "h-11 w-full rounded border border-term-line bg-term-bg px-3 text-sm text-term-text outline-none transition-colors placeholder:text-term-muted/60 focus:border-primary disabled:opacity-50"
const segBtn = (active: boolean) =>
  cn(
    "flex h-9 items-center justify-center rounded text-xs font-medium transition-colors disabled:opacity-40",
    active ? "bg-primary text-primary-foreground" : "bg-term-bg text-term-muted hover:text-term-text",
  )

type DepositRollover = {
  lockedAmount: number
  rolloverRequired: number
  rolloverProgress: number
  remaining: number
  progressPercent: number
  depositsCount: number
}

type BonusRollover = { required: number; progress: number; remaining: number; cancelOnWithdrawal: boolean }

export default function WithdrawPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [method, setMethod] = useState<Method>("pix")
  const [amount, setAmount] = useState("")
  const [pixKey, setPixKey] = useState("")
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("cpf")
  const [crypto, setCrypto] = useState<Crypto>("usdt")
  const [wallet, setWallet] = useState("")

  const [balance, setBalance] = useState(0)
  const [bonusLocked, setBonusLocked] = useState(0)
  const [bonusRollover, setBonusRollover] = useState<BonusRollover | null>(null)
  const [depositRollover, setDepositRollover] = useState<DepositRollover | null>(null)
  const [withdrawalHours, setWithdrawalHours] = useState(72)
  const [profile, setProfile] = useState<ProfileFields | null>(null)
  const [kycStatus, setKycStatus] = useState("unverified")
  const [isVerified, setIsVerified] = useState(false)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => router.push("/futures"), 4000)
    return () => clearTimeout(timer)
  }, [success, router])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login?next=/withdraw")
        return
      }

      const [{ data: bal }, { data: prof }] = await Promise.all([
        supabase.from("user_balances").select("balance_real").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select(`${PROFILE_COLUMNS}, kyc_status, is_verified`).eq("id", user.id).maybeSingle(),
      ])
      if (cancelled) return
      setBalance(Number(bal?.balance_real ?? 0))
      const p = prof as (ProfileFields & { kyc_status?: string; is_verified?: boolean }) | null
      setProfile(p)
      setKycStatus(p?.kyc_status?.toLowerCase().trim() || "unverified")
      setIsVerified(p?.is_verified === true)

      // O servidor reaplica todas as travas no envio; aqui é só informativo.
      try {
        const res = await fetch("/api/promo/status")
        if (res.ok) {
          const promo = await res.json()
          if (promo.hasActiveBonus) {
            setBonusLocked(promo.lockedAmount)
            setBonusRollover({
              required: promo.rolloverRequired,
              progress: promo.rolloverProgress,
              remaining: promo.remaining,
              cancelOnWithdrawal: promo.cancelsOnWithdrawal,
            })
          }
          if (promo.depositRollover) setDepositRollover(promo.depositRollover)
          if (promo.withdrawalHours) setWithdrawalHours(promo.withdrawalHours)
        }
      } catch {}
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router, supabase])

  const completion = profileCompletion(profile)
  const kycOk = kycStatus === "approved" || isVerified
  const depositLocked = depositRollover?.lockedAmount ?? 0
  const available = Math.max(0, balance - bonusLocked - depositLocked)
  const blocked = !completion.complete || !kycOk

  const parsed = useMemo(() => (amount ? Number.parseFloat(amount.replace(/\./g, "").replace(",", ".")) : 0), [amount])

  const onAmount = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const n = e.target.value.replace(/\D/g, "")
    setAmount(n ? brl(Number.parseInt(n, 10) / 100) : "")
  }, [])

  const validationError = (() => {
    if (!parsed) return null
    if (parsed < MIN_WITHDRAWAL) return `Valor mínimo para saque é US$ ${brl(MIN_WITHDRAWAL)}`
    if (parsed > available) return `Saldo disponível para saque: US$ ${brl(available)}`
    return null
  })()

  const destinationOk = method === "pix" ? pixKey.trim().length > 0 : /^0x[a-fA-F0-9]{40}$/.test(wallet.trim())
  const canSubmit = !blocked && !submitting && parsed >= MIN_WITHDRAWAL && parsed <= available && destinationOk

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError("")
    setSubmitting(true)
    try {
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsed,
          method,
          pixKey: pixKey.trim(),
          pixKeyType,
          cryptoType: crypto.toUpperCase(),
          cryptoWallet: wallet.trim(),
          holderName: profile?.full_name ?? "",
          document: profile?.document_number ?? "",
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        setError(result.error || "Erro ao solicitar saque. Tente novamente.")
        return
      }
      setBalance(result.newBalance)
      setBonusLocked(0)
      setSuccess(true)
    } catch {
      setError("Erro de conexão ao solicitar saque. Tente novamente.")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-term-bg px-4 text-term-text">
        <div className="flex size-14 items-center justify-center rounded-full bg-long/15 text-long">
          <Check className="size-7" strokeWidth={3} aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold">Saque solicitado</h1>
        <p className="max-w-xs text-center text-sm leading-relaxed text-term-muted text-pretty">
          {`O valor cairá na sua conta em até ${withdrawalHours} horas. Redirecionando para o terminal...`}
        </p>
      </main>
    )
  }

  return (
    <div className="min-h-dvh bg-term-bg text-term-text">
      <header className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-term-line bg-term-panel px-3 md:px-6">
        <Link
          href="/futures"
          aria-label="Voltar ao terminal"
          className="flex size-8 items-center justify-center rounded text-term-muted hover:bg-term-bg hover:text-term-text"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        <h1 className="text-sm font-semibold">Sacar</h1>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-term-muted">
          <ShieldCheck className="size-3.5 text-long" aria-hidden="true" />
          Transferência protegida
        </span>
      </header>

      {loading ? (
        <div className="flex h-[60vh] items-center justify-center" role="status" aria-label="Carregando">
          <div className="size-6 animate-spin rounded-full border-2 border-term-line border-t-primary" />
        </div>
      ) : (
        <main className="mx-auto grid max-w-5xl gap-4 p-3 md:grid-cols-[1fr_320px] md:p-6">
          <form onSubmit={submit} className={cn(panel, "flex flex-col gap-5 p-4 md:p-6")}>
            {blocked && <Requirements completion={completion} kycOk={kycOk} kycStatus={kycStatus} />}

            <fieldset disabled={blocked} className="flex flex-col gap-5 disabled:opacity-50">
              <div className="flex flex-col gap-2">
                <legend className="text-xs text-term-muted">Método</legend>
                <div role="radiogroup" className="grid grid-cols-2 gap-2">
                  <MethodCard active={method === "pix"} onClick={() => setMethod("pix")} title="PIX" subtitle="Até 1 hora útil">
                    <Image src="/pix-logo.png" alt="" width={20} height={20} className="size-5 object-contain" />
                  </MethodCard>
                  <MethodCard active={method === "crypto"} onClick={() => setMethod("crypto")} title="Cripto" subtitle="USDT ou BTC · ERC-20">
                    <span className="font-mono text-sm font-bold text-term-text">{"₮"}</span>
                  </MethodCard>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="amount" className="flex items-center justify-between text-xs text-term-muted">
                  <span>Valor</span>
                  <button
                    type="button"
                    onClick={() => setAmount(brl(Math.floor(available * 100) / 100))}
                    className="font-medium text-primary hover:underline"
                  >
                    {`Máx. US$ ${brl(available)}`}
                  </button>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-term-muted">US$</span>
                  <input
                    id="amount"
                    inputMode="numeric"
                    value={amount}
                    onChange={onAmount}
                    placeholder="0,00"
                    className={cn(inputCls, "h-12 pl-10 font-mono text-lg font-semibold")}
                    aria-invalid={!!validationError}
                    aria-describedby="amount-hint"
                  />
                </div>
                <p id="amount-hint" className={cn("text-xs", validationError ? "text-short" : "text-term-muted")}>
                  {validationError ?? `Mínimo US$ ${brl(MIN_WITHDRAWAL)}`}
                </p>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {QUICK_AMOUNTS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      disabled={v > available}
                      onClick={() => setAmount(brl(v))}
                      className="h-8 rounded border border-term-line bg-term-bg font-mono text-xs text-term-muted transition-colors hover:border-primary hover:text-term-text disabled:opacity-30"
                    >
                      {v.toLocaleString("pt-BR")}
                    </button>
                  ))}
                </div>
              </div>

              {method === "pix" ? (
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-term-muted">Tipo de chave</span>
                  <div role="radiogroup" className="grid grid-cols-4 gap-1 rounded bg-term-bg p-1">
                    {PIX_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        role="radio"
                        aria-checked={pixKeyType === t.value}
                        onClick={() => {
                          setPixKeyType(t.value)
                          if (t.value === "cpf" && profile?.document_number) setPixKey(profile.document_number)
                        }}
                        className={segBtn(pixKeyType === t.value)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <label htmlFor="pix" className="sr-only">
                    Chave PIX
                  </label>
                  <input
                    id="pix"
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    placeholder={PIX_TYPES.find((t) => t.value === pixKeyType)?.placeholder}
                    className={inputCls}
                    autoComplete="off"
                  />
                  <p className="text-xs leading-relaxed text-term-muted">
                    {`A chave deve estar no nome de ${profile?.full_name || "titular da conta"}. Saques para terceiros são recusados.`}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-term-muted">Moeda</span>
                  <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded bg-term-bg p-1">
                    {(["usdt", "btc"] as const).map((c) => (
                      <button key={c} type="button" role="radio" aria-checked={crypto === c} onClick={() => setCrypto(c)} className={segBtn(crypto === c)}>
                        {c === "usdt" ? "USDT · Tether" : "BTC · Bitcoin"}
                      </button>
                    ))}
                  </div>
                  <label htmlFor="wallet" className="text-xs text-term-muted">
                    Endereço da carteira (ERC-20)
                  </label>
                  <input
                    id="wallet"
                    value={wallet}
                    onChange={(e) => setWallet(e.target.value)}
                    placeholder="0x..."
                    className={cn(inputCls, "font-mono")}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={wallet.length > 0 && !destinationOk}
                  />
                  <p className={cn("text-xs leading-relaxed", wallet && !destinationOk ? "text-short" : "text-term-muted")}>
                    {wallet && !destinationOk
                      ? "Endereço inválido: deve começar com 0x e ter 42 caracteres."
                      : "Somente rede Ethereum (ERC-20). Envios para outra rede não podem ser recuperados."}
                  </p>
                  <div className="flex items-center justify-between rounded border border-term-line bg-term-bg px-3 py-2">
                    <span className="text-xs text-term-muted">{`Aproximado (1 USD = R$ ${USD_TO_BRL.toFixed(2)})`}</span>
                    <span className="font-mono text-sm font-semibold">{`${(parsed / USD_TO_BRL).toFixed(2)} ${crypto.toUpperCase()}`}</span>
                  </div>
                </div>
              )}

              {error && (
                <div role="alert" className="flex items-start gap-2 rounded border border-short/30 bg-short/10 p-3 text-sm text-short">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p className="leading-relaxed">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="flex h-11 items-center justify-center gap-2 rounded bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {submitting ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Processando...
                  </>
                ) : method === "crypto" ? (
                  `Sacar ${(parsed / USD_TO_BRL).toFixed(2)} ${crypto.toUpperCase()}`
                ) : (
                  `Sacar US$ ${amount || "0,00"}`
                )}
              </button>
            </fieldset>
          </form>

          <aside className="flex flex-col gap-4">
            <section className={cn(panel, "flex flex-col gap-3 p-4")} aria-label="Saldo">
              <p className="text-xs text-term-muted">Disponível para saque</p>
              <p className="font-mono text-2xl font-semibold">{`US$ ${brl(available)}`}</p>
              <dl className="flex flex-col gap-1.5 border-t border-term-line pt-3 text-xs">
                <Row label="Saldo total" value={`US$ ${brl(balance)}`} />
                {bonusLocked > 0 && <Row label="Bônus travado" value={`US$ ${brl(bonusLocked)}`} locked />}
                {depositLocked > 0 && <Row label="Depósito travado" value={`US$ ${brl(depositLocked)}`} locked />}
              </dl>
            </section>

            {bonusRollover && (
              <RolloverCard
                title="Rollover do bônus"
                progress={bonusRollover.progress}
                required={bonusRollover.required}
                note={
                  bonusRollover.cancelOnWithdrawal
                    ? "Sacar acima do disponível cancela o bônus."
                    : `Faltam US$ ${brl(bonusRollover.remaining)} em volume negociado.`
                }
              />
            )}
            {depositRollover && (
              <RolloverCard
                title={depositRollover.depositsCount > 1 ? "Rollover dos depósitos" : "Rollover do depósito"}
                progress={depositRollover.rolloverProgress}
                required={depositRollover.rolloverRequired}
                note={`Faltam US$ ${brl(depositRollover.remaining)} em volume para liberar US$ ${brl(depositRollover.lockedAmount)}. O valor segue disponível para operar.`}
              />
            )}

            <section className={cn(panel, "flex items-start gap-3 p-4")}>
              <Clock className="mt-0.5 size-4 shrink-0 text-term-muted" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-term-muted">
                {`Prazo de até ${withdrawalHours} horas úteis. Enquanto pendente, o valor fica reservado e é devolvido se o saque for recusado.`}
              </p>
            </section>
          </aside>
        </main>
      )}
    </div>
  )
}

function Requirements({
  completion,
  kycOk,
  kycStatus,
}: {
  completion: ReturnType<typeof profileCompletion>
  kycOk: boolean
  kycStatus: string
}) {
  return (
    <section aria-label="Requisitos para sacar" className="flex flex-col gap-3 rounded border border-term-line bg-term-bg p-4">
      <div className="flex items-center gap-2">
        <Lock className="size-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold">Saque bloqueado</h2>
      </div>
      <ol className="flex flex-col gap-2">
        <Step
          done={completion.complete}
          title={completion.complete ? "Cadastro completo" : `Complete o cadastro (${completion.percent}%)`}
          detail={completion.complete ? undefined : `Pendente: ${completion.issues.map((i) => i.label).join(", ")}`}
          href="/profile?tab=personal"
          cta="Completar cadastro"
          icon={UserRound}
        />
        <Step
          done={kycOk}
          title={kycOk ? "Identidade verificada" : kycStatus === "pending" ? "Documentos em análise" : "Verifique sua identidade"}
          detail={kycOk ? undefined : kycStatus === "rejected" ? "Verificação recusada. Envie novos documentos." : undefined}
          href="/kyc"
          cta={kycStatus === "pending" ? "Ver status" : "Enviar documentos"}
          icon={ShieldCheck}
        />
      </ol>
    </section>
  )
}

function Step({
  done,
  title,
  detail,
  href,
  cta,
  icon: Icon,
}: {
  done: boolean
  title: string
  detail?: string
  href: string
  cta: string
  icon: typeof UserRound
}) {
  return (
    <li className="flex items-start gap-3">
      {done ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-long" aria-hidden="true" />
      ) : (
        <Icon className="mt-0.5 size-4 shrink-0 text-term-muted" aria-hidden="true" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className={cn("text-sm", done ? "text-term-muted" : "font-medium")}>{title}</p>
        {detail && <p className="text-xs leading-relaxed text-term-muted">{detail}</p>}
      </div>
      {!done && (
        <Link href={href} className="shrink-0 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
          {cta}
        </Link>
      )}
    </li>
  )
}

function MethodCard({
  active,
  onClick,
  title,
  subtitle,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded border p-3 text-left transition-colors",
        active ? "border-primary bg-primary/10" : "border-term-line bg-term-bg hover:border-term-muted",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded bg-term-panel">{children}</span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-term-muted">{subtitle}</span>
      </span>
    </button>
  )
}

function Row({ label, value, locked }: { label: string; value: string; locked?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-1 text-term-muted">
        {locked && <Lock className="size-3" aria-hidden="true" />}
        {label}
      </dt>
      <dd className="font-mono">{value}</dd>
    </div>
  )
}

function RolloverCard({ title, progress, required, note }: { title: string; progress: number; required: number; note: string }) {
  const pct = required > 0 ? Math.min(100, (progress / required) * 100) : 100
  return (
    <section className={cn(panel, "flex flex-col gap-2 p-4")} aria-label={title}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">{title}</p>
        <span className="font-mono text-xs text-term-muted">{`${pct.toFixed(0)}%`}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-term-line">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="font-mono text-xs text-term-muted">{`US$ ${brl(progress)} / US$ ${brl(required)}`}</p>
      <p className="text-xs leading-relaxed text-term-muted">{note}</p>
    </section>
  )
}

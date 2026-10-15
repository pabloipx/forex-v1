import Link from "next/link"
import { ArrowRight, Check, Clock, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react"
import { cn } from "@/lib/utils"

type Stage = "idle" | "review" | "approved" | "rejected"

const STAGE_BY_STATUS: Record<string, Stage> = {
  approved: "approved",
  verified: "approved",
  submitted: "review",
  pending: "review",
  under_review: "review",
  in_review: "review",
  rejected: "rejected",
}

const STAGE_CONFIG: Record<
  Stage,
  {
    label: string
    description: string
    badge: string
    iconWrap: string
    Icon: typeof ShieldCheck
    cta?: string
    step: number
  }
> = {
  idle: {
    label: "Não iniciada",
    description: "Verifique sua identidade para liberar saques e limites maiores.",
    badge: "bg-primary/15 text-primary",
    iconWrap: "bg-primary/15 text-primary",
    Icon: ShieldAlert,
    cta: "Verificar identidade",
    step: 0,
  },
  review: {
    label: "Em análise",
    description: "Recebemos seus documentos. A análise costuma levar até 24 horas.",
    badge: "bg-pending/15 text-pending",
    iconWrap: "bg-pending/15 text-pending",
    Icon: Clock,
    cta: "Ver envio",
    step: 1,
  },
  approved: {
    label: "Verificada",
    description: "Identidade confirmada. Todos os recursos da conta estão liberados.",
    badge: "bg-long/15 text-long",
    iconWrap: "bg-long/15 text-long",
    Icon: ShieldCheck,
    step: 2,
  },
  rejected: {
    label: "Rejeitada",
    description: "Não foi possível validar seus documentos. Envie novamente.",
    badge: "bg-short/15 text-short",
    iconWrap: "bg-short/15 text-short",
    Icon: ShieldX,
    cta: "Reenviar documentos",
    step: 1,
  },
}

const STEPS = ["Envio", "Análise", "Aprovado"]

export function KycCard({ status, isVerified }: { status: string; isVerified: boolean }) {
  const stage: Stage = isVerified ? "approved" : STAGE_BY_STATUS[status] ?? "idle"
  const cfg = STAGE_CONFIG[stage]
  const { Icon } = cfg

  return (
    <section
      aria-labelledby="kyc-title"
      className="flex flex-col gap-4 rounded-md border border-term-line bg-term-panel p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", cfg.iconWrap)}>
            <Icon className="size-5" aria-hidden />
          </span>
          <h3 id="kyc-title" className="text-sm font-semibold">
            Verificação (KYC)
          </h3>
        </div>
        <span className={cn("shrink-0 rounded px-2 py-0.5 text-[11px] font-medium", cfg.badge)}>{cfg.label}</span>
      </div>

      <p className="text-xs leading-relaxed text-term-muted text-pretty">{cfg.description}</p>

      <ol className="flex items-center gap-2" aria-label="Etapas da verificação">
        {STEPS.map((name, i) => {
          const done = i < cfg.step || stage === "approved"
          const current = i === cfg.step && stage !== "approved"
          const failed = current && stage === "rejected"
          return (
            <li key={name} className="flex flex-1 flex-col gap-1.5" aria-current={current ? "step" : undefined}>
              <span
                className={cn(
                  "h-1 rounded-full",
                  done ? "bg-long" : failed ? "bg-short" : current ? "bg-primary" : "bg-term-line",
                )}
              />
              <span
                className={cn(
                  "flex items-center gap-1 text-[11px]",
                  done || current ? "text-term-text" : "text-term-muted",
                )}
              >
                {done && <Check className="size-3 text-long" aria-hidden />}
                {name}
              </span>
            </li>
          )
        })}
      </ol>

      {cfg.cta && (
        <Link
          href="/kyc"
          className={cn(
            "group mt-auto flex items-center justify-center gap-1.5 rounded px-3 py-2 text-sm font-semibold transition-opacity",
            stage === "review"
              ? "bg-term-line text-term-text hover:bg-term-line/70"
              : "bg-primary text-primary-foreground hover:opacity-90",
          )}
        >
          {cfg.cta}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}
    </section>
  )
}

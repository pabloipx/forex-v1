import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Globe, Headphones, ShieldCheck, Zap } from "lucide-react"

const PERKS = [
  { icon: ShieldCheck, title: "Segurança", sub: "de nível institucional" },
  { icon: Zap, title: "Baixas taxas", sub: "e alta liquidez" },
  { icon: Globe, title: "Mais de 200", sub: "criptomoedas" },
  { icon: Headphones, title: "Suporte 24/7", sub: "em português" },
]

export function KbHero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_85%_0%,var(--color-lp-soft),transparent_70%)]"
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pb-16 pt-32 lg:grid-cols-[1fr_1.05fr] lg:pb-20 lg:pt-36">
        <div className="animate-fade-up">
          <h1 className="text-balance text-5xl font-extrabold leading-[1.02] tracking-tight text-lp-ink sm:text-6xl lg:text-7xl">
            O seu próximo <span className="text-lp-primary">nível financeiro</span> começa aqui.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-lp-muted">
            Compre, venda e negocie criptomoedas com segurança, velocidade e as menores taxas do mercado.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth/sign-up"
              className="group inline-flex items-center justify-center gap-3 rounded-lg bg-lp-primary px-7 py-4 text-base font-semibold text-lp-bg shadow-lg shadow-lp-primary/25 transition-colors hover:bg-lp-navy"
            >
              Criar conta gratuita
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>
            <Link
              href="#mercados"
              className="inline-flex items-center justify-center rounded-lg bg-lp-bg px-7 py-4 text-base font-semibold text-lp-ink ring-1 ring-lp-line transition-colors hover:bg-lp-soft"
            >
              Ver mercados
            </Link>
          </div>

          <ul className="mt-12 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {PERKS.map((p) => (
              <li key={p.title} className="flex items-center gap-2.5">
                <p.icon className="h-6 w-6 shrink-0 text-lp-ink" strokeWidth={1.6} aria-hidden="true" />
                <span className="flex flex-col text-xs leading-tight text-lp-muted">
                  <strong className="text-[13px] font-semibold text-lp-ink/80">{p.title}</strong>
                  {p.sub}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-fade-up [animation-delay:150ms]">
          <Image
            src="/images/kryptobit-hero-devices.webp"
            alt="Dashboard da Kryptobit em um notebook e aplicativo da Kryptobit em um smartphone"
            width={1248}
            height={1000}
            priority
            className="h-auto w-full"
          />
        </div>
      </div>
    </section>
  )
}

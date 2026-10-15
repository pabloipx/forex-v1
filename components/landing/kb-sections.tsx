import Link from "next/link"
import Image from "next/image"
import { Apple, ArrowRight, BarChart3, Globe, Lock, Play, Zap } from "lucide-react"

const FEATURES = [
  { icon: Lock, title: "Segurança total", desc: "Seus ativos protegidos com tecnologia de ponta e cold wallet." },
  { icon: Zap, title: "Alta performance", desc: "Negocie com velocidade e máxima estabilidade." },
  { icon: BarChart3, title: "Mais oportunidades", desc: "Acesse centenas de criptoativos e novos lançamentos." },
  { icon: Globe, title: "Presença global", desc: "Uma corretora feita para investidores do mundo todo." },
]

const FOOTER_NAV = [
  { href: "#mercados", label: "Mercados" },
  { href: "/futures", label: "Trade" },
  { href: "#ganhe", label: "Ganhe" },
  { href: "#institucional", label: "Institucional" },
  { href: "/transactions", label: "Mais" },
]

export function KbWhy() {
  return (
    <section id="institucional" className="scroll-mt-24 px-6 py-20 lg:py-24">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-20">
        <div>
          <h2 className="text-balance text-4xl font-extrabold leading-tight tracking-tight text-lp-ink">
            Por que escolher a <span className="text-lp-primary">Kryptobit?</span>
          </h2>
          <p className="mt-5 text-pretty text-[17px] leading-relaxed text-lp-muted">
            Uma plataforma completa, segura e global para você aproveitar todo o potencial do mercado cripto.
          </p>
          <Link
            href="/futures"
            className="group mt-8 inline-flex items-center gap-3 rounded-lg bg-lp-primary px-6 py-3.5 text-[15px] font-semibold text-lp-bg shadow-lg shadow-lp-primary/25 transition-colors hover:bg-lp-navy"
          >
            Conheça a plataforma
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        </div>
        <ul className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <span className="flex h-18 w-18 items-center justify-center rounded-2xl bg-lp-soft text-lp-primary">
                <f.icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <h3 className="mt-7 text-lg font-bold text-lp-ink">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-lp-muted">{f.desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function KbAppBanner() {
  return (
    <section id="ganhe" className="scroll-mt-24 px-6 pb-20 pt-10">
      <div className="relative mx-auto flex max-w-7xl flex-col gap-8 rounded-3xl bg-lp-soft p-8 shadow-[0_20px_50px_-20px_rgba(15,42,143,0.25)] sm:p-10 lg:flex-row lg:items-center lg:gap-12">
        <div className="lg:max-w-sm">
          <h2 className="text-balance text-3xl font-extrabold tracking-tight text-lp-navy">Negocie em qualquer lugar</h2>
          <p className="mt-3 text-pretty leading-relaxed text-lp-muted">
            Acesse a Kryptobit pelo app e tenha o mercado cripto sempre na sua mão.
          </p>
        </div>
        <div className="relative z-10 flex flex-wrap gap-3">
          <Link
            href="/futures"
            aria-label="Baixar na App Store"
            className="flex items-center gap-2.5 rounded-xl bg-lp-ink px-4 py-2.5 text-lp-bg transition-transform hover:-translate-y-0.5"
          >
            <Apple className="h-6 w-6" fill="currentColor" aria-hidden="true" />
            <span className="flex flex-col leading-none">
              <small className="text-[10px]">Baixar na</small>
              <strong className="mt-0.5 text-lg font-semibold">App Store</strong>
            </span>
          </Link>
          <Link
            href="/futures"
            aria-label="Disponível no Google Play"
            className="flex items-center gap-2.5 rounded-xl bg-lp-ink px-4 py-2.5 text-lp-bg transition-transform hover:-translate-y-0.5"
          >
            <Play className="h-6 w-6 text-lp-up" fill="currentColor" aria-hidden="true" />
            <span className="flex flex-col leading-none">
              <small className="text-[10px]">Disponível no</small>
              <strong className="mt-0.5 text-lg font-semibold">Google Play</strong>
            </span>
          </Link>
        </div>
        <div className="pointer-events-none -mx-8 -mb-8 overflow-hidden rounded-b-3xl sm:-mx-10 sm:-mb-10 lg:absolute lg:inset-y-0 lg:-top-12 lg:right-0 lg:m-0 lg:w-[42%] lg:rounded-r-3xl lg:rounded-bl-none">
          <Image
            src="/images/kryptobit-app-banner.webp"
            alt=""
            aria-hidden="true"
            width={1672}
            height={823}
            className="h-full w-full object-cover object-right [mask-image:linear-gradient(to_right,transparent,black_35%)]"
          />
        </div>
      </div>
    </section>
  )
}

export function KbFooter() {
  return (
    <footer className="border-t border-lp-line px-6 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <img src="/images/kryptobit-logo-dark.png" alt="Kryptobit" width={1525} height={493} className="h-7 w-auto" loading="lazy" />
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-lp-muted">Global Crypto Exchange</p>
        </div>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-6">
          {FOOTER_NAV.map((n) => (
            <Link key={n.label} href={n.href} className="text-[15px] text-lp-ink/80 transition-colors hover:text-lp-primary">
              {n.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-lp-muted">© {new Date().getFullYear()} Kryptobit. Todos os direitos reservados.</p>
      </div>
    </footer>
  )
}

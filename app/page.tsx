import Link from "next/link"
import { Layers, ShieldCheck, Target, Gauge } from "lucide-react"
import { CryptoTicker } from "@/components/landing/crypto-ticker"
import { LiveChart } from "@/components/landing/live-chart"
import { HeroBackground } from "@/components/landing/hero-background"
import { SiteHeader } from "@/components/landing/site-header"
import { MarketsSection } from "@/components/landing/markets-section"
import { MAKER_FEE, MARKETS, TAKER_FEE } from "@/lib/futures/markets"

export const metadata = {
  title: "Kryptobit — Forex e Futuros com alavancagem",
  description:
    "Negocie Forex, metais e futuros perpétuos de cripto com alavancagem, TP/SL e execução instantânea na Kryptobit.",
}

const maxLeverage = Math.max(...MARKETS.map((m) => m.maxLeverage))
const pct = (v: number) => `${(v * 100).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`

const conditions = [
  { value: `${maxLeverage}x`, label: "Alavancagem máxima em Forex" },
  { value: pct(MAKER_FEE), label: "Taxa maker por ordem" },
  { value: pct(TAKER_FEE), label: "Taxa taker por ordem" },
  { value: "0,01", label: "Lote mínimo" },
]

const features = [
  {
    icon: Gauge,
    title: "Alavancagem ajustável",
    desc: `De 1x a ${maxLeverage}x por posição, com margem isolada e preço de liquidação calculado antes da ordem.`,
  },
  {
    icon: Target,
    title: "Take profit e stop loss",
    desc: "Defina alvos e proteções na abertura ou edite depois. O motor executa automaticamente no gatilho.",
  },
  {
    icon: Layers,
    title: "Ordens a mercado e limitadas",
    desc: "Entre no preço atual ou deixe ordens no livro. Acompanhe tudo em posições, ordens e histórico.",
  },
  {
    icon: ShieldCheck,
    title: "Conta protegida",
    desc: "Verificação de identidade, gestão de sessões e saldo segregado por usuário.",
  },
]

export default function HomePage() {
  return (
    <main id="top" className="relative flex min-h-screen flex-col bg-[#06100c] font-sans">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <HeroBackground />
        <div className="relative z-20 mx-auto grid max-w-7xl items-center gap-12 px-6 pb-16 pt-32 lg:grid-cols-2 lg:pt-40">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#2190ff]/30 bg-[#2190ff]/10 px-4 py-1.5 text-xs font-semibold text-[#8cc4ff]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4da6ff]" aria-hidden="true" />
              Forex · Metais · Futuros perpétuos
            </p>
            <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Opere os mercados globais com a <span className="text-foreground">Krypto</span><span className="text-[#2190FF]">bit</span>
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/65 md:text-lg">
              EUR/USD, ouro, Bitcoin e mais {MARKETS.length - 3} instrumentos em um terminal profissional: gráfico em tempo
              real, livro de ofertas, alavancagem de até {maxLeverage}x e gestão de risco com TP/SL.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/sign-up"
                className="rounded-xl bg-[#2190ff] px-8 py-4 text-center text-base font-bold text-[#03140d] transition-colors hover:bg-[#4da6ff]"
              >
                Abrir conta grátis
              </Link>
              <Link
                href="/futures"
                className="rounded-xl border border-white/15 px-8 py-4 text-center text-base font-bold text-white transition-colors hover:bg-white/10"
              >
                Abrir o terminal
              </Link>
            </div>
          </div>

          <div id="plataforma" className="scroll-mt-24">
            <LiveChart />
          </div>
        </div>

        <div className="relative z-20 pb-4">
          <CryptoTicker />
        </div>
      </section>

      <MarketsSection />

      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#4da6ff]">Terminal</p>
            <h2 className="mt-3 text-balance text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
              Tudo o que um trader de derivativos precisa
            </h2>
          </div>

          <div className="mt-12 overflow-hidden rounded-2xl border border-white/10">
            <img
              src="/images/ptg-showcase.png"
              alt="Terminal da Kryptobit com gráfico de EUR/USD, livro de ofertas e painel de ordens Long e Short"
              className="w-full"
            />
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2190ff]/15 text-[#4da6ff]">
                  <f.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="condicoes" className="scroll-mt-24 px-6 pb-20">
        <div className="mx-auto max-w-7xl rounded-2xl border border-[#2190ff]/25 bg-[#0a1a13] p-8 sm:p-10">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">Condições de negociação</h2>
          <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {conditions.map((c) => (
              <div key={c.label}>
                <dt className="text-xs text-white/50 sm:text-sm">{c.label}</dt>
                <dd className="mt-1 font-mono text-2xl font-bold text-[#4da6ff] sm:text-3xl">{c.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-balance text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            Sua próxima operação começa aqui
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-white/60 md:text-lg">
            Cadastre-se em minutos, verifique sua conta e acesse Forex, metais e cripto com a mesma margem.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/auth/sign-up"
              className="w-full rounded-xl bg-[#2190ff] px-10 py-4 text-base font-bold text-[#03140d] transition-colors hover:bg-[#4da6ff] sm:w-auto"
            >
              Criar conta
            </Link>
            <Link
              href="/auth/login"
              className="w-full rounded-xl border border-white/15 px-10 py-4 text-base font-bold text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <img src="/images/kryptobit-logo.png" alt="Kryptobit" className="h-8 w-auto self-start" />
          <p className="max-w-xl text-xs leading-relaxed text-white/40">
            Negociar derivativos alavancados envolve alto risco e pode resultar na perda de todo o capital investido. ©{" "}
            {new Date().getFullYear()} Kryptobit. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </main>
  )
}

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { CATEGORY_LABELS, MARKETS, type MarketCategory } from "@/lib/futures/markets"

const ORDER: MarketCategory[] = ["forex", "metals", "crypto"]

const DESCRIPTIONS: Record<MarketCategory, string> = {
  forex: "Os pares de moedas mais líquidos do mundo, negociados em lotes padrão.",
  metals: "Ouro e prata como proteção e oportunidade em qualquer cenário.",
  crypto: "Contratos perpétuos liquidados em USDT, abertos 24 horas por dia.",
}

export function MarketsSection() {
  return (
    <section id="mercados" className="scroll-mt-24 px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#4da6ff]">Mercados</p>
            <h2 className="mt-3 text-balance text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
              {MARKETS.length} instrumentos em uma única conta
            </h2>
          </div>
          <Link
            href="/futures"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4da6ff] hover:text-[#8cc4ff]"
          >
            Ver no terminal
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {ORDER.map((category) => {
            const items = MARKETS.filter((m) => m.category === category)
            const maxLev = Math.max(...items.map((m) => m.maxLeverage))
            return (
              <article key={category} className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">{CATEGORY_LABELS[category]}</h3>
                  <span className="rounded-full bg-[#2190ff]/15 px-2.5 py-1 font-mono text-xs font-semibold text-[#8cc4ff]">
                    até {maxLev}x
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{DESCRIPTIONS[category]}</p>
                <ul className="mt-5 flex flex-col divide-y divide-white/5 border-t border-white/5">
                  {items.map((m) => (
                    <li key={m.symbol}>
                      <Link
                        href={`/futures?symbol=${m.symbol}`}
                        className="flex items-center justify-between py-2.5 text-sm transition-colors hover:text-[#4da6ff]"
                      >
                        <span className="font-mono font-semibold text-white">{m.symbol}</span>
                        <span className="text-white/50">{m.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

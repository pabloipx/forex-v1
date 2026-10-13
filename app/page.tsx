import Link from "next/link"
import { Globe, ChevronDown, ShieldCheck, Zap, GraduationCap, Wallet, LineChart, Clock } from "lucide-react"
import { CryptoTicker } from "@/components/landing/crypto-ticker"
import { LiveChart } from "@/components/landing/live-chart"
import { HeroBackground } from "@/components/landing/hero-background"

export const metadata = {
  title: "URYN BROKER - Trade inteligente e seguro, do seu jeito",
  description:
    "Mais que uma corretora, um ecossistema completo para você evoluir. Aprenda, teste e negocie com liberdade, transparência e proteção.",
}

const features = [
  {
    icon: Zap,
    title: "Execução instantânea",
    desc: "Ordens processadas em tempo real, sem travamentos nos momentos decisivos.",
  },
  {
    icon: ShieldCheck,
    title: "Segurança de ponta",
    desc: "Verificação em duas etapas e gestão de dispositivos para proteger sua conta.",
  },
  {
    icon: GraduationCap,
    title: "Conta demo grátis",
    desc: "Treine com R$10.000 virtuais e evolua antes de operar com dinheiro real.",
  },
  {
    icon: Wallet,
    title: "Depósito e saque ágil",
    desc: "Movimente sua banca com praticidade e total transparência.",
  },
]

const stats = [
  { value: "+85%", label: "Payout por operação" },
  { value: "24/7", label: "Mercados OTC" },
  { value: "<1s", label: "Execução de ordens" },
  { value: "60+", label: "Ativos disponíveis" },
]

export default function HomePage() {
  return (
    <main id="top" className="relative flex min-h-screen flex-col bg-[#07090d]">
      {/* Cabeçalho com navegação em pílula */}
      <header className="fixed inset-x-0 top-0 z-50 px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-white/10 bg-[#07090d]/70 px-4 py-2.5 backdrop-blur-xl">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <img
              src="/images/uryn-fox-logo.png"
              alt="URYNBROKER"
              className="h-8 w-auto object-contain sm:h-9"
            />
          </Link>

          {/* Navegação central (desktop) */}
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
            <Link
              href="#top"
              className="rounded-full px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Início
            </Link>
            <Link
              href="#grafico"
              className="rounded-full px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Plataforma
            </Link>
            <Link
              href="#recursos"
              className="rounded-full px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Recursos
            </Link>
            <Link
              href="#cotacoes"
              className="rounded-full px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Cotações
            </Link>
          </nav>

          {/* Ações */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 text-sm font-medium text-white/60 sm:flex">
              <Globe className="h-4 w-4" />
              PT
            </span>
            <Link
              href="/auth/login"
              className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Login
            </Link>
            <Link
              href="/auth/sign-up"
              className="rounded-full bg-[#f97316] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_30px_-8px_rgba(249, 115, 22,0.8)] transition-colors hover:bg-[#fb923c]"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      {/* HERO — tela cheia */}
      <section className="relative flex min-h-screen flex-col overflow-hidden">
        {/* Fundo: brilhos e efeitos animados reativos a rolagem */}
        <HeroBackground />

        {/* Conteúdo do hero */}
        <div className="relative z-20 flex flex-1 flex-col items-center justify-center px-6 py-28 text-center">
          <div className="animate-fade-up mx-auto max-w-4xl">
            <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              Trade inteligente e seguro, do seu jeito.
            </h1>

            <p className="mt-5 text-3xl font-bold text-white sm:text-4xl md:text-5xl">
              Bem-vindo à{" "}
              <span className="bg-gradient-to-r from-[#fb923c] via-[#fdba74] to-[#f97316] bg-clip-text text-transparent">
                URYN BROKER
              </span>
            </p>

            <p className="mx-auto mt-7 max-w-2xl text-pretty text-base leading-relaxed text-white/70 md:text-lg">
              Mais que uma corretora, somos um ecossistema completo — feito para você evoluir.
              <br className="hidden sm:block" />{" "}
              Aqui, você aprende, testa e negocia com liberdade, transparência e proteção.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/auth/sign-up"
                className="w-full rounded-xl bg-[#f97316] px-10 py-4 text-base font-bold text-white shadow-[0_10px_40px_-8px_rgba(249, 115, 22,0.8)] transition-all hover:bg-[#fb923c] sm:w-auto"
              >
                Criar conta
              </Link>
              <Link
                href="/auth/login"
                className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-10 py-4 text-base font-bold text-white transition-colors hover:bg-white/10 sm:w-auto"
              >
                Login
              </Link>
            </div>
          </div>
        </div>

        {/* Faixa de cotações + indicador de rolagem */}
        <div id="cotacoes" className="relative z-20">
          <CryptoTicker />
          <div className="flex justify-center pb-5 pt-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md">
              <ChevronDown className="h-5 w-5 animate-bounce text-white/60" />
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO — Gráfico ao vivo */}
      <section id="grafico" className="relative scroll-mt-24 px-6 py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#f97316]/30 bg-[#f97316]/10 px-4 py-1.5 text-xs font-semibold text-[#fdba74]">
              <LineChart className="h-3.5 w-3.5" />
              Gráfico em tempo real
            </span>
            <h2 className="mt-5 text-balance text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
              Acompanhe o mercado se mexendo a cada segundo
            </h2>
            <p className="mt-5 max-w-lg text-pretty text-base leading-relaxed text-white/60 md:text-lg">
              Velas atualizadas em tempo real, leitura clara de tendência e execução rápida.
              Veja abaixo uma prévia do gráfico que você usa na plataforma URYN BROKER.
            </p>

            <ul className="mt-8 space-y-4">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#f97316]/20 text-[#fdba74]">
                  <Zap className="h-3.5 w-3.5" />
                </span>
                <p className="text-sm text-white/70">
                  <span className="font-semibold text-white">Candles ao vivo</span> — o gráfico se
                  atualiza continuamente, como na conta real.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#f97316]/20 text-[#fdba74]">
                  <Clock className="h-3.5 w-3.5" />
                </span>
                <p className="text-sm text-white/70">
                  <span className="font-semibold text-white">Múltiplos tempos</span> — opere em
                  timeframes de segundos a minutos.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#f97316]/20 text-[#fdba74]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </span>
                <p className="text-sm text-white/70">
                  <span className="font-semibold text-white">Dados confiáveis</span> — preços de
                  mercado aberto vindos de fontes reais.
                </p>
              </li>
            </ul>

            <Link
              href="/auth/sign-up"
              className="mt-8 inline-flex rounded-xl bg-[#f97316] px-8 py-3.5 text-sm font-bold text-white shadow-[0_10px_40px_-8px_rgba(249, 115, 22,0.8)] transition-all hover:bg-[#fb923c]"
            >
              Começar a operar
            </Link>
          </div>

          <LiveChart />
        </div>
      </section>

      {/* SEÇÃO — Showcase (imagem) */}
      <section className="relative overflow-hidden px-6 py-20 sm:py-28">
        <div className="absolute left-1/2 top-1/2 h-96 w-[60rem] max-w-[95%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f97316]/10 blur-[140px]" />
        <div className="relative mx-auto max-w-5xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#f97316]/30 bg-[#f97316]/10 px-4 py-1.5 text-xs font-semibold text-[#fdba74]">
            A plataforma
          </span>
          <h2 className="mx-auto mt-5 max-w-3xl text-balance text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            Uma plataforma feita para decolar seus resultados
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-white/60 md:text-lg">
            Interface intuitiva, gráficos poderosos e todas as ferramentas que você precisa em um
            só lugar.
          </p>

          <div className="group relative mx-auto mt-12 max-w-4xl">
            {/* Glow pulsante atrás da moldura */}
            <div className="animate-tech-pulse absolute -inset-6 rounded-[2rem] bg-[#f97316]/25 blur-3xl" />

            {/* Pontos orbitando o quadro */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 sm:block">
              <span className="animate-tech-orbit absolute h-2.5 w-2.5 rounded-full bg-[#fdba74] shadow-[0_0_12px_4px_rgba(251,146,60,0.8)]" />
              <span
                className="animate-tech-orbit absolute h-1.5 w-1.5 rounded-full bg-[#f97316] shadow-[0_0_10px_3px_rgba(249,115,22,0.7)]"
                style={{ animationDelay: "-4.5s", animationDuration: "12s" }}
              />
            </div>

            {/* Moldura tecnológica */}
            <div className="relative overflow-hidden rounded-2xl border border-[#f97316]/30 bg-[#0b0f14] shadow-[0_30px_90px_-20px_rgba(249,115,22,0.55)]">
              {/* Grade tecnológica animada */}
              <div className="tech-grid pointer-events-none absolute inset-0 z-10 opacity-40" />

              {/* Vinheta para dar profundidade */}
              <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(11,15,20,0.75)_100%)]" />

              {/* Linha de varredura (scanline) */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-16 bg-gradient-to-b from-[#fdba74]/40 via-[#f97316]/15 to-transparent blur-[2px] animate-tech-scan" />

              {/* Cantos estilo HUD */}
              <span className="pointer-events-none absolute left-3 top-3 z-30 h-6 w-6 rounded-tl-md border-l-2 border-t-2 border-[#f97316]" />
              <span className="pointer-events-none absolute right-3 top-3 z-30 h-6 w-6 rounded-tr-md border-r-2 border-t-2 border-[#f97316]" />
              <span className="pointer-events-none absolute bottom-3 left-3 z-30 h-6 w-6 rounded-bl-md border-b-2 border-l-2 border-[#f97316]" />
              <span className="pointer-events-none absolute bottom-3 right-3 z-30 h-6 w-6 rounded-br-md border-b-2 border-r-2 border-[#f97316]" />

              {/* Badge "ao vivo" */}
              <div className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full border border-[#f97316]/40 bg-[#0b0f14]/80 px-3 py-1.5 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#fb923c] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#f97316]" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#fdba74]">
                  Sistema ativo
                </span>
              </div>

              <img
                src="/images/uryn-showcase.png"
                alt="Plataforma de trading da URYN BROKER com gráfico de candles, foguete e painel de operações"
                className="relative z-0 w-full transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO — Recursos */}
      <section id="recursos" className="relative scroll-mt-24 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#f97316]/30 bg-[#f97316]/10 px-4 py-1.5 text-xs font-semibold text-[#fdba74]">
              Por que a URYN BROKER
            </span>
            <h2 className="mt-5 text-balance text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
              Tudo que você precisa para operar com confiança
            </h2>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-[#f97316]/40 hover:bg-[#f97316]/[0.06]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f97316]/15 text-[#fdba74] transition-colors group-hover:bg-[#f97316]/25">
                  <f.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Estatísticas */}
          <div className="mt-16 grid grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-8 sm:grid-cols-4 sm:gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="bg-gradient-to-r from-[#fb923c] to-[#fdba74] bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl">
                  {s.value}
                </p>
                <p className="mt-1 text-xs text-white/50 sm:text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEÇÃO — CTA final */}
      <section className="relative overflow-hidden px-6 py-24">
        <div className="absolute left-1/2 top-1/2 h-72 w-[50rem] max-w-[95%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f97316]/15 blur-[130px]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="text-balance text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            Pronto para começar sua jornada?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-white/60 md:text-lg">
            Crie sua conta gratuita, treine na conta demo e negocie quando estiver pronto.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/auth/sign-up"
              className="w-full rounded-xl bg-[#f97316] px-10 py-4 text-base font-bold text-white shadow-[0_10px_40px_-8px_rgba(249, 115, 22,0.8)] transition-all hover:bg-[#fb923c] sm:w-auto"
            >
              Criar conta grátis
            </Link>
            <Link
              href="/auth/login"
              className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-10 py-4 text-base font-bold text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="relative border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <img
            src="/images/uryn-fox-logo.png"
            alt="URYNBROKER"
            className="h-7 w-auto object-contain"
          />
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} URYN BROKER. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </main>
  )
}

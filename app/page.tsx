import { KbHeader } from "@/components/landing/kb-header"
import { KbHero } from "@/components/landing/kb-hero"
import { KbTicker } from "@/components/landing/kb-ticker"
import { KbAppBanner, KbFooter, KbWhy } from "@/components/landing/kb-sections"

export const metadata = {
  title: "Kryptobit — Global Crypto Exchange",
  description: "Compre, venda e negocie criptomoedas com segurança, velocidade e as menores taxas do mercado.",
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-lp-bg font-sans text-lp-ink">
      <KbHeader />
      <main id="top">
        <KbHero />
        <KbTicker />
        <KbWhy />
        <KbAppBanner />
      </main>
      <KbFooter />
    </div>
  )
}

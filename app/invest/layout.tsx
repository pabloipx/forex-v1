import type React from "react"
import type { Metadata, Viewport } from "next"
import { investFontVars } from "@/lib/invest-fonts"

export const metadata: Metadata = {
  title: "Carteira de Investimentos | Kryptobit",
  description: "Acompanhe seu patrimônio, a distribuição dos ativos e os rendimentos mensais da sua carteira na Kryptobit.",
}

export const viewport: Viewport = {
  themeColor: "#040914",
}

export default function InvestLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${investFontVars} iv-theme`}>{children}</div>
}

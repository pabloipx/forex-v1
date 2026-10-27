import type { Metadata } from "next"
import { InvestView } from "@/components/invest/invest-view"

export const metadata: Metadata = {
  title: "Renda Passiva — Invest | Kryptobit",
  description: "Invista a partir de US$ 500 e receba 10% de rendimento mensal, liberado todo dia 30.",
}

export default function InvestPage() {
  return <InvestView />
}

import type React from "react"
import { Instrument_Serif, Manrope } from "next/font/google"

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-iv-display",
})

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-iv-sans",
})

export default function InvestLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${sans.variable} iv-theme`}>{children}</div>
}

import { JetBrains_Mono, Manrope } from "next/font/google"

export const adminSans = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-admin-sans",
  display: "swap",
})

export const adminMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-admin-mono",
  display: "swap",
})

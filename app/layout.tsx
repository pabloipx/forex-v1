import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "URYN BROKER - Plataforma de Trading OTC",
  description: "Negocie opções binárias OTC com a URYN BROKER",
  generator: "URYN BROKER",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0B0F14",
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="bg-[#0B0F14]" style={{ height: "100%" }} data-scroll-behavior="smooth">
      <body
        className={`${inter.className} antialiased bg-[#0B0F14]`}
        style={{
          minHeight: "100%",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        {children}
        <Analytics />
      </body>
    </html>
  )
}

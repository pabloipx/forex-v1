import type { Metadata } from "next"
import { adminMono, adminSans } from "./fonts"

export const metadata: Metadata = {
  title: "Painel Admin — Kryptobit",
  robots: { index: false, follow: false, nocache: true },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${adminSans.variable} ${adminMono.variable} admin-theme min-h-screen antialiased`}>{children}</div>
  )
}

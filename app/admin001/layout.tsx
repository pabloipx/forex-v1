import type { Metadata } from "next"
import { adminMono, adminSans } from "../admin/fonts"

export const metadata: Metadata = {
  title: "Acesso restrito",
  robots: { index: false, follow: false, nocache: true },
}

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${adminSans.variable} ${adminMono.variable} admin-theme min-h-screen antialiased`}>{children}</div>
  )
}

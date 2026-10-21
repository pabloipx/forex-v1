import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ForexAdmin } from "@/components/admin/forex/forex-admin"
import { isAdminRequest } from "@/lib/admin/session"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Admin | Kryptobit Futuros & Forex",
  robots: { index: false, follow: false },
}

export default async function AdminDashboardPage() {
  if (!(await isAdminRequest())) notFound()
  return <ForexAdmin />
}

import type { Metadata } from "next"
import { ForexAdmin } from "@/components/admin/forex/forex-admin"

export const metadata: Metadata = {
  title: "Admin | URYN Futuros & Forex",
  robots: { index: false, follow: false },
}

export default function AdminDashboardPage() {
  return <ForexAdmin />
}

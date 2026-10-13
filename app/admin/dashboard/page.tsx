import { Suspense } from "react"
import AdminDashboardClient from "./admin-dashboard-client"

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
          <div className="text-white">Carregando...</div>
        </div>
      }
    >
      <AdminDashboardClient />
    </Suspense>
  )
}

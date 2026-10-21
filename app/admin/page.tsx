import { notFound, redirect } from "next/navigation"
import { isAdminRequest } from "@/lib/admin/session"

export const dynamic = "force-dynamic"

// Sem sessao, /admin responde 404: o login so existe em /admin001.
export default async function AdminEntryPage() {
  if (!(await isAdminRequest())) notFound()
  redirect("/admin/dashboard")
}

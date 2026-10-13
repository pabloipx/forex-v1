import { redirect } from "next/navigation"
import { isAdminRequest } from "@/lib/admin/session"

export const dynamic = "force-dynamic"

export default async function AdminEntryPage() {
  redirect((await isAdminRequest()) ? "/admin/dashboard" : "/admin001")
}

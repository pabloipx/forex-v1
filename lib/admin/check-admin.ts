import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const ADMIN_EMAILS = ["pabloandrade1790@gmail.com", "admin@atlasinvest.com"]

/**
 * Check if current user is an admin
 */
export async function checkAdmin(): Promise<{ isAdmin: boolean; user: any | null }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { isAdmin: false, user: null }
    }

    const adminClient = createAdminClient()
    const { data: profile } = await adminClient.from("profiles").select("is_admin, email").eq("id", user.id).single()

    const isAdmin =
      profile?.is_admin === true ||
      ADMIN_EMAILS.includes(user.email || "") ||
      ADMIN_EMAILS.includes(profile?.email || "")

    return {
      isAdmin,
      user,
    }
  } catch (error) {
    console.error("Error checking admin status:", error)
    return { isAdmin: false, user: null }
  }
}

// Alias for compatibility
export const checkIsAdmin = checkAdmin

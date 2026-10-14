import type { Metadata } from "next"
import { Suspense } from "react"
import { ProfileView } from "@/components/profile/profile-view"

export const metadata: Metadata = {
  title: "Meu perfil | Kryptobit",
  description: "Dados pessoais, estatísticas de trading, preferências e segurança da conta.",
}

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileView />
    </Suspense>
  )
}

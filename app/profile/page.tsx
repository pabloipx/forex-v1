import type { Metadata } from "next"
import { ProfileView } from "@/components/profile/profile-view"

export const metadata: Metadata = {
  title: "Meu perfil | Profit Trading Global",
  description: "Dados pessoais, estatísticas de trading, preferências e segurança da conta.",
}

export default function ProfilePage() {
  return <ProfileView />
}

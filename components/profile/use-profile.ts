"use client"

import useSWR from "swr"
import type { ClientTradingPrefs } from "@/hooks/use-futures"

export interface ProfileData {
  id: string
  email: string
  full_name: string | null
  nickname: string | null
  phone: string | null
  document_number: string | null
  birth_date: string | null
  country: string | null
  address_line: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  occupation: string | null
  trading_experience: string | null
  kyc_status: string
  is_verified: boolean
  created_at: string | null
  last_login_at: string | null
  preferences: ClientTradingPrefs
  testMode: boolean
}

class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new HttpError(json.error ?? "Falha ao carregar", res.status)
  return json
}

export function useProfile() {
  const { data, error, isLoading, mutate } = useSWR<{ profile: ProfileData }>("/api/futures/profile", fetcher, {
    revalidateOnFocus: false,
  })
  const save = async (patch: Partial<Omit<ProfileData, "preferences">> & { preferences?: Partial<ClientTradingPrefs> }) => {
    const res = await fetch("/api/futures/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error ?? "Falha ao salvar")
    await mutate({ profile: json.profile }, { revalidate: false })
    return json.profile as ProfileData
  }
  return {
    profile: data?.profile,
    unauthorized: (error as HttpError | undefined)?.status === 401,
    error,
    isLoading,
    save,
  }
}

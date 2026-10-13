"use client"

import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"

export interface ChartScript {
  id: string
  name: string
  code: string
  enabled: boolean
}

const COLUMNS = "id, name, code, enabled"

async function requireUser() {
  const supabase = createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error("Entre na sua conta para usar scripts")
  return supabase
}

async function fetchScripts(): Promise<ChartScript[]> {
  const supabase = await requireUser()
  const { data, error } = await supabase.from("chart_scripts").select(COLUMNS).order("created_at", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ChartScript[]
}

export function useChartScripts() {
  const { data, error, isLoading, mutate } = useSWR("chart-scripts", fetchScripts, { revalidateOnFocus: false })

  const create = async (name: string, code: string) => {
    const supabase = await requireUser()
    const { data: row, error: err } = await supabase
      .from("chart_scripts")
      .insert({ name: name.trim().slice(0, 60) || "Script", code })
      .select(COLUMNS)
      .single()
    if (err) throw new Error(err.message)
    await mutate((prev) => [...(prev ?? []), row as ChartScript], { revalidate: false })
    return row as ChartScript
  }

  const update = async (id: string, patch: Partial<Omit<ChartScript, "id">>) => {
    const supabase = await requireUser()
    const clean = { ...patch, ...(patch.name != null ? { name: patch.name.trim().slice(0, 60) || "Script" } : {}) }
    await mutate((prev) => prev?.map((s) => (s.id === id ? { ...s, ...clean } : s)), { revalidate: false })
    const { error: err } = await supabase
      .from("chart_scripts")
      .update({ ...clean, updated_at: new Date().toISOString() })
      .eq("id", id)
    if (err) {
      await mutate()
      throw new Error(err.message)
    }
  }

  const remove = async (id: string) => {
    const supabase = await requireUser()
    await mutate((prev) => prev?.filter((s) => s.id !== id), { revalidate: false })
    const { error: err } = await supabase.from("chart_scripts").delete().eq("id", id)
    if (err) {
      await mutate()
      throw new Error(err.message)
    }
  }

  return { scripts: data ?? [], error: error as Error | undefined, isLoading, create, update, remove }
}

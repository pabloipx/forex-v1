"use client"

import useSWR from "swr"
import { Monitor, Smartphone, Tablet, MapPin } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge, ErrorNote, SmallButton } from "./ui"
import { dateTime, usd, signedUsd } from "./use-admin"
import { UserActivityFeed } from "./user-logs-dialog"
import { cn } from "@/lib/utils"

interface Device {
  id: string
  device_name: string | null
  model: string | null
  browser: string | null
  os: string | null
  ip: string | null
  city: string | null
  region: string | null
  country: string | null
  login_count?: number
  last_seen?: string | null
  created_at: string | null
}

interface Detail {
  profile: Record<string, string | number | boolean | null>
  balances: { real: number; demo: number }
  stats: { deposited: number; withdrawn: number; openPositions: number; closedPositions: number; realizedPnl: number; logins: number }
  devices: Device[]
  logins: Device[]
}

const fetcher = async (url: string): Promise<Detail> => {
  const res = await fetch(url, { cache: "no-store" })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? "Erro ao carregar usuário")
  return body.data
}

const kycLabel: Record<string, string> = { approved: "Aprovado", rejected: "Rejeitado", pending: "Pendente", submitted: "Em análise" }
const expLabel: Record<string, string> = { beginner: "Iniciante", intermediate: "Intermediário", advanced: "Avançado" }

const place = (d: Pick<Device, "city" | "region" | "country">) => [d.city, d.region, d.country].filter(Boolean).join(", ") || "Local não detectado"

function DeviceIcon({ name }: { name: string | null }) {
  const cls = "size-4 shrink-0 text-term-muted"
  if (name?.startsWith("Celular")) return <Smartphone className={cls} aria-hidden />
  if (name?.startsWith("Tablet")) return <Tablet className={cls} aria-hidden />
  return <Monitor className={cls} aria-hidden />
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] uppercase tracking-wide text-term-muted">{label}</dt>
      <dd className={cn("break-words text-sm", mono && "font-mono tabular-nums")}>{value || "—"}</dd>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-term-line bg-term-bg px-3 py-2.5">
      <span className="text-[11px] uppercase tracking-wide text-term-muted">{label}</span>
      <span className={cn("font-mono text-sm tabular-nums", tone === "up" && "text-long", tone === "down" && "text-short")}>{value}</span>
    </div>
  )
}

function AccessRow({ d, extra }: { d: Device; extra: React.ReactNode }) {
  const deviceLabel = d.model ? `${d.model} · ${d.os ?? ""}` : (d.device_name ?? "Dispositivo")
  return (
    <li className="flex items-start gap-3 border-b border-term-line/60 py-3 last:border-0">
      <DeviceIcon name={d.device_name} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium">{deviceLabel}</span>
          {d.browser && <Badge>{d.browser}</Badge>}
        </div>
        <p className="flex items-center gap-1 text-xs text-term-muted">
          <MapPin className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{place(d)}</span>
          {d.ip && <span className="font-mono">· {d.ip}</span>}
        </p>
      </div>
      <div className="shrink-0 text-right text-xs text-term-muted">{extra}</div>
    </li>
  )
}

export function UserDetailSheet({ user, onClose }: { user: { id: string; email: string } | null; onClose: () => void }) {
  const { data, error, isLoading, mutate, isValidating } = useSWR(user ? `/api/admin/user-detail?userId=${user.id}` : null, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: false,
  })
  const p = data?.profile ?? {}
  const str = (k: string) => (p[k] == null ? null : String(p[k]))
  const lastAccess = data?.logins[0] ?? data?.devices[0]

  return (
    <Sheet open={!!user} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 border-term-line bg-term-panel p-0 text-term-text sm:max-w-2xl">
        <SheetHeader className="gap-2 border-b border-term-line px-6 py-5">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <SheetTitle className="text-lg text-term-text">{str("full_name") || user?.email}</SheetTitle>
            {data && <Badge tone={p.kyc_status === "approved" ? "up" : p.kyc_status === "rejected" ? "down" : "accent"}>KYC {kycLabel[str("kyc_status") ?? ""] ?? str("kyc_status")}</Badge>}
            {p.is_blocked ? <Badge tone="down">Bloqueado</Badge> : null}
          </div>
          <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-term-muted">
            <span>{user?.email}</span>
            {lastAccess && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" aria-hidden />
                Último acesso em {place(lastAccess)}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5">
          <ErrorNote error={error} />
          {isLoading && <p className="py-10 text-center text-sm text-term-muted">Carregando dados do usuário...</p>}
          {data && user && (
            <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <TabsList className="bg-term-bg">
                  <TabsTrigger value="overview">Visão geral</TabsTrigger>
                  <TabsTrigger value="access">Acessos ({data.stats.logins})</TabsTrigger>
                  <TabsTrigger value="activity">Atividade</TabsTrigger>
                </TabsList>
                <SmallButton tone="muted" onClick={() => mutate()} disabled={isValidating}>
                  Atualizar
                </SmallButton>
              </div>

              <TabsContent value="overview" className="flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Metric label="Saldo real" value={usd(data.balances.real)} />
                  <Metric label="Saldo demo" value={usd(data.balances.demo)} />
                  <Metric label="PnL realizado" value={signedUsd(data.stats.realizedPnl)} tone={data.stats.realizedPnl >= 0 ? "up" : "down"} />
                  <Metric label="Depositado" value={usd(data.stats.deposited)} />
                  <Metric label="Sacado" value={usd(data.stats.withdrawn)} />
                  <Metric label="Posições" value={`${data.stats.openPositions} abertas · ${data.stats.closedPositions} fechadas`} />
                </div>

                <section className="flex flex-col gap-3" aria-labelledby="ud-personal">
                  <h3 id="ud-personal" className="text-sm font-semibold">Dados pessoais</h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                    <Field label="Nome" value={str("full_name")} />
                    <Field label="Apelido" value={str("nickname")} />
                    <Field label="Celular" value={str("phone")} mono />
                    <Field label="Documento" value={str("document_number")} mono />
                    <Field label="Nascimento" value={str("birth_date")} mono />
                    <Field label="Profissão" value={str("occupation")} />
                    <Field label="Experiência" value={expLabel[str("trading_experience") ?? ""] ?? str("trading_experience")} />
                    <Field label="Cadastro" value={str("created_at") && dateTime(str("created_at")!)} mono />
                    <Field label="Último login" value={str("last_login_at") && dateTime(str("last_login_at")!)} mono />
                  </dl>
                </section>

                <section className="flex flex-col gap-3" aria-labelledby="ud-address">
                  <h3 id="ud-address" className="text-sm font-semibold">Endereço cadastrado</h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                    <Field label="Endereço" value={str("address_line")} />
                    <Field label="Cidade" value={str("city")} />
                    <Field label="Estado" value={str("state")} />
                    <Field label="CEP" value={str("postal_code")} mono />
                    <Field label="País" value={str("country")} />
                  </dl>
                </section>
              </TabsContent>

              <TabsContent value="access" className="flex flex-col gap-6">
                <section className="flex flex-col gap-1" aria-labelledby="ud-devices">
                  <h3 id="ud-devices" className="text-sm font-semibold">Dispositivos ({data.devices.length})</h3>
                  {data.devices.length === 0 ? (
                    <p className="py-4 text-sm text-term-muted">Nenhum dispositivo registrado ainda. Aparece no próximo login do usuário.</p>
                  ) : (
                    <ul>
                      {data.devices.map((d) => (
                        <AccessRow
                          key={d.id}
                          d={d}
                          extra={
                            <>
                              <p className="font-mono">{d.last_seen ? dateTime(d.last_seen) : "—"}</p>
                              <p>{d.login_count ?? 1} login(s)</p>
                            </>
                          }
                        />
                      ))}
                    </ul>
                  )}
                </section>
                <section className="flex flex-col gap-1" aria-labelledby="ud-logins">
                  <h3 id="ud-logins" className="text-sm font-semibold">Histórico de logins</h3>
                  {data.logins.length === 0 ? (
                    <p className="py-4 text-sm text-term-muted">Nenhum login registrado ainda.</p>
                  ) : (
                    <ol>
                      {data.logins.map((d) => (
                        <AccessRow key={d.id} d={d} extra={<time dateTime={d.created_at ?? undefined} className="font-mono">{dateTime(d.created_at)}</time>} />
                      ))}
                    </ol>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="activity" className="flex min-h-[60vh] flex-col">
                <UserActivityFeed key={user.id} userId={user.id} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

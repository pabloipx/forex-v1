"use client"

import { useState } from "react"
import { Check, Copy, Send, Trophy } from "lucide-react"
import type { AffiliateInfo } from "./types"
import { useMoney } from "./currency-context"

export function SectionCompetition({ affiliate }: { affiliate: AffiliateInfo }) {
  const brl = useMoney()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-gray-900">Competição</h1>
        <p className="mt-1 text-[15px] text-gray-600">Sua posição no ranking mensal de afiliados</p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
            <Trophy className="h-6 w-6 text-emerald-600" />
          </span>
          <div>
            <p className="text-[17px] font-medium text-gray-900">Temporada atual</p>
            <p className="text-[15px] text-gray-600">
              {affiliate.total_referrals} indicações · {brl(affiliate.total_earned)} em comissões
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Indicações totais</p>
            <p className="mt-1 text-[22px] font-semibold text-gray-900">{affiliate.total_referrals}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Com depósito</p>
            <p className="mt-1 text-[22px] font-semibold text-gray-900">{affiliate.referrals_with_deposit}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Conversão</p>
            <p className="mt-1 text-[22px] font-semibold text-gray-900">
              {affiliate.total_referrals > 0
                ? `${Math.round((affiliate.referrals_with_deposit / affiliate.total_referrals) * 100)}%`
                : "0%"}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export function SectionSubAffiliate({ affiliate }: { affiliate: AffiliateInfo }) {
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const link = `${origin}/afiliadosbr?sub=${affiliate.code}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-gray-900">Sub-afiliado</h1>
        <p className="mt-1 text-[15px] text-gray-600">Convide outros afiliados e receba uma parte das comissões</p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-[15px] text-gray-700">Seu link de indicação de afiliados</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="flex-1 truncate rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">{link}</code>
          <button
            type="button"
            onClick={copy}
            className="flex h-11 items-center gap-2 rounded-lg bg-emerald-400 px-5 text-[15px] font-medium text-gray-900 transition-colors hover:bg-emerald-500"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar link"}
          </button>
        </div>
        <p className="mt-4 text-[15px] text-gray-600">
          Nenhum sub-afiliado cadastrado ainda. Compartilhe o link acima para começar sua rede.
        </p>
      </section>
    </div>
  )
}

export function SectionPostbacks({ affiliate }: { affiliate: AffiliateInfo }) {
  const origin = typeof window !== "undefined" ? window.location.origin : ""

  const events = [
    { name: "Registro", url: `${origin}/api/affiliate/track?code=${affiliate.code}&event=registration` },
    { name: "Primeiro depósito", url: `${origin}/api/affiliate/track?code=${affiliate.code}&event=first_deposit` },
    { name: "Depósito", url: `${origin}/api/affiliate/track?code=${affiliate.code}&event=deposit` },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-gray-900">Postbacks</h1>
        <p className="mt-1 text-[15px] text-gray-600">Receba notificações automáticas dos eventos das suas campanhas</p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-sm text-gray-600">
            <tr>
              <th className="px-6 py-3 font-medium">Evento</th>
              <th className="px-6 py-3 font-medium">URL de postback</th>
            </tr>
          </thead>
          <tbody className="text-[15px] text-gray-800">
            {events.map((event) => (
              <tr key={event.name} className="border-t border-gray-100">
                <td className="px-6 py-4 font-medium">{event.name}</td>
                <td className="px-6 py-4">
                  <code className="block truncate rounded bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    {event.url}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export function SectionTelegramBot({ affiliate }: { affiliate: AffiliateInfo }) {
  const [copied, setCopied] = useState(false)
  const command = `/vincular ${affiliate.code}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex max-w-[760px] flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-gray-900">Bot do Telegram</h1>
        <p className="mt-1 text-[15px] text-gray-600">
          Receba notificações de registros, depósitos e comissões diretamente no Telegram
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50">
            <Send className="h-5 w-5 text-sky-600" />
          </span>
          <div>
            <p className="text-[17px] font-medium text-gray-900">Não vinculado</p>
            <p className="text-[15px] text-gray-600">Vincule sua conta em dois passos</p>
          </div>
        </div>

        <ol className="mt-6 flex flex-col gap-4 text-[15px] text-gray-800">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-700">
              1
            </span>
            Abra o bot <span className="font-medium">@URYNAfiliadosBot</span> no Telegram e inicie a conversa.
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-700">
              2
            </span>
            Envie o comando abaixo para vincular sua conta de afiliado.
          </li>
        </ol>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <code className="flex-1 truncate rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">{command}</code>
          <button
            type="button"
            onClick={copy}
            className="flex h-11 items-center gap-2 rounded-lg bg-emerald-400 px-5 text-[15px] font-medium text-gray-900 transition-colors hover:bg-emerald-500"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar comando"}
          </button>
        </div>
      </section>
    </div>
  )
}

export function SectionAccount({ affiliate, email }: { affiliate: AffiliateInfo; email: string }) {
  const brl = useMoney()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-gray-900">Configurações da conta</h1>
        <p className="mt-1 text-[15px] text-gray-600">Dados da sua conta de afiliado</p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <dl className="grid gap-5 md:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-500">E-mail</dt>
            <dd className="mt-1 text-[15px] text-gray-900">{email}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Código de afiliado</dt>
            <dd className="mt-1 font-mono text-[15px] text-gray-900">{affiliate.code}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Comissão</dt>
            <dd className="mt-1 text-[15px] text-gray-900">
              {affiliate.commission_model === "cpa"
                ? brl(affiliate.cpa_amount ?? 0) + " por indicação (CPA)"
                : affiliate.commission_model === "hybrid"
                  ? affiliate.commission_rate + "% + " + brl(affiliate.cpa_amount ?? 0) + " CPA"
                  : affiliate.commission_rate + "% (RevShare)"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Status</dt>
            <dd className="mt-1 text-[15px] text-gray-900">
              {affiliate.status === "active" ? "Ativo" : affiliate.status}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Total ganho</dt>
            <dd className="mt-1 text-[15px] text-gray-900">{brl(affiliate.total_earned)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Saldo disponível</dt>
            <dd className="mt-1 text-[15px] text-gray-900">{brl(affiliate.balance)}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

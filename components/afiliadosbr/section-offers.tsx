"use client"

import { useState } from "react"
import { ChevronRight, ChevronUp, Laptop, Smartphone, Tablet } from "lucide-react"
import { OfferDetail, type OfferSummary } from "./offer-detail"
import type { AffiliateInfo } from "./types"
import { useMoney } from "./currency-context"

interface SectionOffersProps {
  affiliate: AffiliateInfo
}

export function SectionOffers({ affiliate }: SectionOffersProps) {
  const brl = useMoney()
  const [selected, setSelected] = useState<OfferSummary | null>(null)

  const model = affiliate.commission_model ?? "hybrid"
  const cpaAmount = affiliate.cpa_amount ?? 100

  const offers: OfferSummary[] = []

  if (model === "revshare" || model === "hybrid") {
    offers.push({
      id: "revenue",
      model: "revenue",
      title: `URYN · ${affiliate.commission_rate}% · Revenue`,
      rate: `${affiliate.commission_rate}%`,
      payout: `${affiliate.commission_rate}%`,
    })
  }

  if (model === "cpa" || model === "hybrid") {
    offers.push({
      id: "cpa",
      model: "cpa",
      title: `URYN · ${brl(cpaAmount)} · CPA`,
      rate: brl(cpaAmount),
      payout: brl(cpaAmount),
    })
  }

  if (selected) {
    return <OfferDetail offer={selected} affiliate={affiliate} onBack={() => setSelected(null)} />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="text-[15px] text-gray-600">Ofertas ativas</span>
        <span className="h-px flex-1 bg-gray-200" />
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500">
          <ChevronUp className="h-4 w-4" />
        </span>
      </div>

      {offers.map((offer) => (
        <section key={offer.id} className="rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-orange-400">
                UB
              </span>
              <div>
                <p className="text-[17px] font-medium text-gray-900">{offer.title}</p>
                <p className="text-[15px] text-emerald-600">Ativa</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelected(offer)}
              className="flex h-11 items-center gap-2 rounded-lg bg-emerald-400 px-5 text-[15px] font-medium text-gray-900 transition-colors hover:bg-emerald-500"
            >
              Obtenha um link
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-x-auto border-t border-gray-100">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-sm text-gray-600">
                <tr>
                  <th className="px-6 py-3 font-medium">Taxa atual</th>
                  <th className="px-6 py-3 font-medium">Plataformas</th>
                  <th className="px-6 py-3 font-medium">Saldo</th>
                  <th className="px-6 py-3 font-medium">Região</th>
                </tr>
              </thead>
              <tbody className="text-[15px] text-gray-800">
                <tr>
                  <td className="px-6 py-4 font-medium">{offer.rate}</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-2 text-gray-500">
                      <Smartphone className="h-4 w-4" />
                      <Tablet className="h-4 w-4" />
                      <Laptop className="h-4 w-4" />
                    </span>
                  </td>
                  <td className="px-6 py-4">{brl(affiliate.balance)}</td>
                  <td className="px-6 py-4">Brasil (LATAM)</td>
                </tr>
              </tbody>
            </table>
          </div>

        </section>
      ))}
    </div>
  )
}

"use client"

import Image from "next/image"
import { useMemo, useState } from "react"
import { Check, ChevronLeft, Copy, HelpCircle, Info, Laptop, Smartphone, Tablet } from "lucide-react"
import type { AffiliateInfo } from "./types"
import { useMoney } from "./currency-context"

export interface OfferSummary {
  id: string
  model: "revenue" | "cpa"
  title: string
  rate: string
  payout: string
}

interface OfferDetailProps {
  offer: OfferSummary
  affiliate: AffiliateInfo
  onBack: () => void
}

const TABS = ["Links", "Ativação", "Tarifas", "Anunciante", "Regras"] as const
type Tab = (typeof TABS)[number]

const RULE_SECTIONS = [
  {
    id: "gerais",
    title: "Restrições gerais",
    body: [
      "• Não se apresente como um funcionário/representante da URYN ou as suas fontes de tráfego como perfis oficiais da URYN em redes sociais ou websites. Suas fontes de tráfego não devem induzir ao erro, fazendo crer que são oficiais, e não devem ser semelhantes aos websites e/ou perfis de redes sociais oficiais da URYN. Se você utilizar um website para a promoção da URYN, ele não deve conter a marca URYN em seu nome e deve ser claramente identificado como não oficial na primeira tela.",
      "• Não faça login na conta da URYN do seu cliente e não realize operações em nome deles. Não é permitido operar em nome de outra pessoa para promover a corretora e criar conteúdo para fins de marketing. Você só pode operar estritamente na sua própria conta.",
      "• Não compre publicidade usando o link de afiliado e não dê lances para consultas de marca da URYN. Publicidade contextual de pesquisa e display só pode ser usada ao promover seus próprios websites.",
    ],
  },
  {
    id: "marketing",
    title: "Diretrizes de marketing",
    body: [
      "• Não prometa lucro garantido, renda fixa ou resultados sem risco. Toda comunicação deve deixar claro que operar envolve risco de perda do capital investido.",
      "• Não utilize resultados financeiros falsos, prints editados ou depoimentos fabricados para atrair novos clientes.",
      "• Materiais criativos devem manter o mesmo padrão visual da marca e nunca imitar comunicados oficiais da corretora.",
    ],
  },
  {
    id: "trafego",
    title: "Tipo de tráfego",
    body: [
      "Permitido: redes sociais próprias, canais de conteúdo, listas de e-mail opt-in, grupos de sinais próprios, tráfego pago em display e vídeo para páginas próprias.",
      "Proibido: tráfego incentivado, pop-under, cashback, extensões de navegador, spam, SMS em massa e cloaking.",
    ],
  },
  {
    id: "negativas",
    title: "Palavras negativas",
    body: [
      "Ao rodar campanhas pagas, adicione como palavras negativas os termos de marca: URYN, URYN Broker, URYN login, URYN entrar, URYN oficial, URYN app e variações com erros de digitação.",
    ],
  },
  {
    id: "apps",
    title: "Diretrizes de aplicativos",
    body: [
      "Aplicativos próprios não podem usar o nome nem o logotipo da URYN como identidade principal, devem informar de forma visível que não são oficiais e precisam de aprovação prévia do gerente antes da publicação nas lojas.",
    ],
  },
  {
    id: "regras",
    title: "Regras",
    body: [
      "O descumprimento de qualquer item acima pode gerar bloqueio das comissões, encerramento da conta de afiliado e cancelamento dos pagamentos pendentes, conforme o contrato de parceria.",
    ],
  },
]

export function OfferDetail({ offer, affiliate, onBack }: OfferDetailProps) {
  const brl = useMoney()
  const [tab, setTab] = useState<Tab>("Links")
  const [afftrack, setAfftrack] = useState("")
  const [copied, setCopied] = useState(false)
  const [activeRule, setActiveRule] = useState(RULE_SECTIONS[0].id)

  // O cadastro le `ref` (codigo) e `subid` (campanha). Usar outros nomes de parametro
  // faz a indicacao ser perdida silenciosamente, entao o link e montado com eles.
  const link = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const params = new URLSearchParams({ ref: affiliate.code })
    if (afftrack.trim()) params.set("subid", afftrack.trim())
    return `${origin}/auth/sign-up?${params.toString()}`
  }, [affiliate.code, afftrack])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar para ofertas"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-200 bg-gray-900 text-sm font-semibold text-emerald-400">
          UB
        </span>
        <div>
          <h2 className="text-[26px] font-normal leading-tight text-gray-900">{offer.title}</h2>
          <p className="text-[15px] text-emerald-600">Ativa</p>
        </div>
      </header>

      <nav className="flex items-center gap-7 border-b border-gray-200">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`-mb-px border-b-2 pb-3 text-[15px] transition-colors ${
              tab === item
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {item}
          </button>
        ))}
      </nav>

      {tab === "Links" && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h3 className="text-[19px] text-gray-900">Obtenha links para o tráfego</h3>
              <p className="max-w-xl text-[15px] leading-relaxed text-gray-600">
                Os links detectam automaticamente a localidade e o dispositivo dos seus usuários e os direcionam para
                uma landing page ou loja adequada. Você pode escolher a landing page para o seu tráfego no campo Tipo de
                Instrumento.
              </p>
            </div>

            <div className="flex max-w-xl flex-col gap-2">
              <label htmlFor="afftrack" className="flex items-center gap-1.5 text-[15px] text-gray-800">
                Afftrack
                <HelpCircle className="h-4 w-4 text-gray-400" />
              </label>
              <input
                id="afftrack"
                value={afftrack}
                onChange={(event) => setAfftrack(event.target.value.replace(/\s/g, ""))}
                placeholder="Inserir afftrack"
                className="h-12 rounded-lg border border-gray-300 px-4 text-[15px] text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-emerald-500"
              />
            </div>

            <div className="flex max-w-xl flex-col gap-2">
              <span className="flex items-center gap-1.5 text-[15px] text-gray-800">
                Link para tráfego misto
                <HelpCircle className="h-4 w-4 text-gray-400" />
              </span>
              <div className="flex h-12 items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 pl-4 pr-2">
                <span className="flex-1 truncate text-[15px] text-gray-800">{link}</span>
                <button
                  type="button"
                  onClick={copyLink}
                  aria-label="Copiar link"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              {copied && <span className="text-sm text-emerald-600">Link copiado para a área de transferência</span>}
            </div>
          </div>

          <aside className="h-fit rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between">
              <span className="text-xs uppercase tracking-wide text-gray-500">Saldo</span>
              <Info className="h-4 w-4 text-amber-500" />
            </div>
            <p className="mt-3 text-2xl text-gray-900">{brl(affiliate.balance)}</p>
            <p className="mt-1 text-[15px] text-gray-500">Seu lucro com esta oferta</p>
          </aside>
        </div>
      )}

      {tab === "Ativação" && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <h3 className="text-[19px] text-gray-900">Ativação da oferta</h3>
            <p className="max-w-xl text-[15px] leading-relaxed text-gray-600">
              Sua oferta já está ativa e pronta para receber tráfego. Todo cadastro feito pelo seu link é atribuído
              automaticamente ao código <strong className="font-medium text-gray-900">{affiliate.code}</strong> e passa a
              contar nas suas estatísticas em tempo real.
            </p>
            <dl className="max-w-xl divide-y divide-gray-100 rounded-xl border border-gray-200">
              {[
                ["Código de afiliado", affiliate.code],
                ["Modelo de comissão", offer.model === "cpa" ? "CPA" : "Revenue Share"],
                ["Status", "Ativa"],
                ["Atribuição", "Último clique · 30 dias"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-5 py-3.5">
                  <dt className="text-[15px] text-gray-600">{label}</dt>
                  <dd className="text-[15px] text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {tab === "Tarifas" && (
        <div className="max-w-2xl overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-sm text-gray-600">
              <tr>
                <th className="px-5 py-3 font-medium">Taxa atual</th>
                <th className="px-5 py-3 font-medium">Plataformas</th>
                <th className="px-5 py-3 font-medium">Saldo</th>
                <th className="px-5 py-3 font-medium">Região</th>
              </tr>
            </thead>
            <tbody className="text-[15px] text-gray-800">
              <tr>
                <td className="px-5 py-4">{offer.payout}</td>
                <td className="px-5 py-4">
                  <span className="flex items-center gap-2 text-gray-500">
                    <Smartphone className="h-4 w-4" />
                    <Tablet className="h-4 w-4" />
                    <Laptop className="h-4 w-4" />
                  </span>
                </td>
                <td className="px-5 py-4">{brl(affiliate.balance)}</td>
                <td className="px-5 py-4">Brasil (LATAM)</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === "Anunciante" && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="flex flex-col gap-5 rounded-xl border border-gray-200 p-6 text-[15px] leading-relaxed text-gray-700">
            <p>URYN — A mais simples, completa e lucrativa plataforma de trading.</p>
            <p>
              Promova: cursos, salas de sinais, robôs de trading, canais de operação ao vivo, entre outros produtos e
              ganhe comissões ao cadastrar novos traders.
            </p>
            <p>
              Nosso sistema de trading é um dos mais completos do mercado, com a possibilidade de operar ações,
              criptomoedas e commodities na modalidade de trading rápido.
            </p>
            <p>
              A plataforma tem um design intuitivo, transmitindo credibilidade. Tudo pensado para maximizar a conversão
              do cliente e mantê-lo operando por um longo período de tempo.
            </p>
            <p>
              Temos um time de dealers e market makers que acompanha as operações 24h por dia para prevenir fraudes e
              garantir condições de trading favoráveis.
            </p>
            <p>Contamos com um time de suporte dedicado 24h por dia, 7 dias por semana, para o seu cliente.</p>
          </article>

          <aside className="flex flex-col gap-5">
            <div className="flex items-center justify-center rounded-xl border border-gray-200 p-8">
              <Image
                src="/images/urynbroker-logo.png"
                alt="URYN BROKER"
                width={1500}
                height={400}
                className="h-10 w-auto"
              />
            </div>

            <div className="flex flex-col gap-5 rounded-xl border border-gray-200 p-5">
              <div>
                <p className="text-[15px] text-gray-500">Site</p>
                <a href="/" className="text-[15px] text-emerald-700 hover:underline">
                  https://urynbroker.com
                </a>
              </div>
              <div>
                <p className="text-[15px] text-gray-500">Plataforma</p>
                <span className="mt-1.5 flex items-center gap-3 text-gray-500">
                  <Smartphone className="h-4 w-4" />
                  <Tablet className="h-4 w-4" />
                  <Laptop className="h-4 w-4" />
                </span>
              </div>
              <div>
                <p className="text-[15px] text-gray-500">Instrumentos de negociação</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["Digital options", "Binary options", "Forex", "CFD"].map((item) => (
                    <span key={item} className="rounded-md bg-gray-100 px-2.5 py-1 text-sm text-gray-700">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[15px] text-gray-500">Regiões</p>
                <span className="mt-2 inline-flex rounded-md bg-gray-100 px-2.5 py-1 text-sm text-gray-700">
                  Brasil (LATAM)
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {tab === "Regras" && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-10">
            {RULE_SECTIONS.map((section) => (
              <section key={section.id} id={`rule-${section.id}`} className="flex flex-col gap-3">
                <h3 className="text-[19px] text-gray-900">{section.title}</h3>
                {section.body.map((paragraph) => (
                  <p key={paragraph.slice(0, 24)} className="max-w-xl text-[15px] leading-relaxed text-gray-700">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>

          <nav aria-label="Seções das regras" className="h-fit lg:sticky lg:top-6">
            <ul className="flex flex-col gap-1">
              {RULE_SECTIONS.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#rule-${section.id}`}
                    onClick={() => setActiveRule(section.id)}
                    className={`block rounded-lg px-4 py-2.5 text-[15px] transition-colors ${
                      activeRule === section.id
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </div>
  )
}

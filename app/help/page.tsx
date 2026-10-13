"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  FileText,
  HelpCircle,
  DollarSign,
  Shield,
  CreditCard,
  TrendingUp,
  ExternalLink,
} from "lucide-react"

interface FAQItem {
  question: string
  answer: string
  category: string
}

const faqs: FAQItem[] = [
  {
    category: "trading",
    question: "Como faço para começar a operar?",
    answer:
      "Para começar a operar, primeiro faça um depósito na sua conta. Depois, vá para a tela de trading, selecione o ativo que deseja operar, defina o valor do investimento e o tempo de expiração, e clique em 'Acima' (Call) se acredita que o preço vai subir, ou 'Abaixo' (Put) se acredita que vai descer.",
  },
  {
    category: "trading",
    question: "O que é conta Demo?",
    answer:
      "A conta Demo é uma conta de prática com saldo virtual de R$ 10.000,00. Você pode usar para aprender a operar sem arriscar dinheiro real. Os resultados não afetam seu saldo real.",
  },
  {
    category: "trading",
    question: "Qual o valor mínimo para operar?",
    answer:
      "O valor mínimo para cada operação é de R$ 1,00. Você pode ajustar o valor conforme sua estratégia de trading.",
  },
  {
    category: "deposito",
    question: "Como faço um depósito?",
    answer:
      "Vá em Perfil > Depósito, selecione o valor desejado e gere o QR Code PIX. Escaneie o código com o app do seu banco ou copie o código para fazer o pagamento. O saldo é creditado automaticamente após a confirmação.",
  },
  {
    category: "deposito",
    question: "Qual o valor mínimo de depósito?",
    answer: "O valor mínimo para depósito é de R$ 50,00.",
  },
  {
    category: "deposito",
    question: "Quanto tempo leva para o depósito cair?",
    answer:
      "Depósitos via PIX são processados em até 15 minutos. Assim que o pagamento for confirmado pelo banco, seu saldo será atualizado automaticamente.",
  },
  {
    category: "saque",
    question: "Como solicitar um saque?",
    answer:
      "Vá em Perfil > Saque, informe o valor e sua chave PIX. O saque é processado em até 72 horas úteis após a solicitação.",
  },
  {
    category: "saque",
    question: "Qual o valor mínimo para saque?",
    answer: "O valor mínimo para saque é de R$ 100,00.",
  },
  {
    category: "seguranca",
    question: "Meus dados estão seguros?",
    answer:
      "Sim! Utilizamos criptografia de ponta a ponta e seguimos as melhores práticas de segurança. Seus dados financeiros nunca são compartilhados com terceiros.",
  },
  {
    category: "seguranca",
    question: "Como proteger minha conta?",
    answer:
      "Recomendamos usar uma senha forte e única, não compartilhar seus dados de acesso e verificar sua conta através do KYC.",
  },
]

const categories = [
  { id: "all", name: "Todas", icon: HelpCircle },
  { id: "trading", name: "Trading", icon: TrendingUp },
  { id: "deposito", name: "Depósito", icon: DollarSign },
  { id: "saque", name: "Saque", icon: CreditCard },
  { id: "seguranca", name: "Segurança", icon: Shield },
]

export default function HelpPage() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null)

  const filteredFAQs = selectedCategory === "all" ? faqs : faqs.filter((faq) => faq.category === selectedCategory)

  return (
    <div className="min-h-screen bg-[#0B0F14]">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 border-b border-[#1F2933] bg-[#0B0F14]">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-xl font-bold text-white">Central de Ajuda</h1>
      </div>

      <div className="px-4 py-6 space-y-6">
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#1A2332] to-[#121826] border border-[#1F2933]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-[#f97316]/20 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-[#f97316]" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Precisa de ajuda?</h3>
              <p className="text-[#9CA3AF] text-sm">Fale com nosso suporte automatizado</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/suporte")}
            className="w-full py-3 rounded-xl bg-[#f97316] text-white font-semibold"
          >
            Iniciar Atendimento
          </button>
        </div>

        {/* Category Filter */}
        <div>
          <h2 className="text-sm font-semibold text-[#9CA3AF] mb-3">Categorias</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-[#f97316] text-white"
                    : "bg-[#121826] text-[#9CA3AF] border border-[#1F2933]"
                }`}
              >
                <cat.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div>
          <h2 className="text-sm font-semibold text-[#9CA3AF] mb-3">Perguntas Frequentes</h2>
          <div className="space-y-2">
            {filteredFAQs.map((faq, index) => (
              <div key={index} className="rounded-xl bg-[#121826] border border-[#1F2933] overflow-hidden">
                <button
                  onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <span className="text-white font-medium pr-4">{faq.question}</span>
                  {expandedFAQ === index ? (
                    <ChevronUp className="w-5 h-5 text-[#6B7280] flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#6B7280] flex-shrink-0" />
                  )}
                </button>
                {expandedFAQ === index && (
                  <div className="px-4 pb-4">
                    <p className="text-[#9CA3AF] text-sm leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Additional Resources */}
        <div>
          <h2 className="text-sm font-semibold text-[#9CA3AF] mb-3">Recursos Adicionais</h2>
          <div className="space-y-2">
            <button className="w-full p-4 rounded-xl bg-[#121826] border border-[#1F2933] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-[#9CA3AF]" />
                <span className="text-white">Termos de Uso</span>
              </div>
              <ExternalLink className="w-4 h-4 text-[#6B7280]" />
            </button>

            <button className="w-full p-4 rounded-xl bg-[#121826] border border-[#1F2933] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-[#9CA3AF]" />
                <span className="text-white">Política de Privacidade</span>
              </div>
              <ExternalLink className="w-4 h-4 text-[#6B7280]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

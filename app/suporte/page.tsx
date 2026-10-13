"use client"

import { useState, useRef, useEffect } from "react"
import { ArrowLeft, MessageCircle, Clock, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

const supportFlow: Record<
  string,
  { message: string; options?: { label: string; value: string }[]; input?: boolean; inputPlaceholder?: string }
> = {
  START: {
    message: `👋 Olá! Bem-vindo ao suporte da URYN BROKER.

Antes de começarmos, como posso te chamar?`,
    input: true,
    inputPlaceholder: "Digite seu nome...",
  },
  GREETING: {
    message: `Prazer em te conhecer, {name}! 🙌

Estou aqui para te ajudar a resolver qualquer situação da forma mais rápida possível.

Me conta, qual assunto você precisa de ajuda hoje?`,
    options: [
      { label: "💰 Depósitos e saldo", value: "DEPOSIT" },
      { label: "💸 Saques e prazos", value: "WITHDRAW" },
      { label: "🪪 Verificação de conta (KYC)", value: "KYC" },
      { label: "📈 Operações e resultados", value: "TRADES" },
      { label: "🔧 Problemas técnicos", value: "TECH" },
      { label: "❓ Outro assunto", value: "OTHER" },
    ],
  },
  DEPOSIT: {
    message: `Entendi, {name}! Vamos resolver isso juntos. 💰

Antes de mais nada, alguns pontos importantes sobre depósitos:

📌 Valor mínimo: R$ 50,00
📌 Processamento via PIX: até 15 minutos
📌 Sem taxas de depósito

Me conta mais sobre sua situação:`,
    options: [
      { label: "Fiz um depósito e não caiu ainda", value: "DEPOSIT_PENDING" },
      { label: "Depositei valor diferente do esperado", value: "DEPOSIT_VALUE" },
      { label: "Tenho dúvida sobre o processo", value: "DEPOSIT_DOUBT" },
      { label: "⬅️ Voltar ao menu", value: "GREETING" },
    ],
  },
  DEPOSIT_PENDING: {
    message: `{name}, entendo sua preocupação! Vamos verificar juntos. ⏳

Geralmente os depósitos caem em até 15 minutos. Me responde:

1️⃣ O valor já foi debitado da sua conta bancária?
2️⃣ Você usou a chave PIX correta da plataforma?
3️⃣ Há quanto tempo você fez o depósito?

Se foi há menos de 15 minutos, recomendo aguardar mais um pouco. Às vezes em horários de pico pode demorar um pouquinho mais.

Isso te ajudou?`,
    options: [
      { label: "✅ Sim, vou aguardar!", value: "RESOLVED_WAIT" },
      { label: "⏰ Já passou de 15 minutos", value: "DEPOSIT_LATE" },
      { label: "⬅️ Voltar", value: "DEPOSIT" },
    ],
  },
  DEPOSIT_LATE: {
    message: `Entendo, {name}. Se já passou de 15 minutos e o valor foi debitado da sua conta, vamos investigar isso. 🔍

Para agilizar a análise, preciso que você confirme:

• O valor exato do depósito
• O horário aproximado
• Se recebeu alguma confirmação do banco

Posso registrar esse caso para nossa equipe analisar com prioridade?`,
    options: [
      { label: "✅ Sim, registrar meu caso", value: "TICKET_DEPOSIT" },
      { label: "🔄 Vou verificar novamente", value: "DEPOSIT" },
    ],
  },
  DEPOSIT_VALUE: {
    message: `{name}, sobre valores de depósito: 📋

• Depósitos abaixo de R$ 50 são estornados em até 24h
• Se depositar valor diferente do selecionado, o valor real é creditado
• Não há limite máximo para depósitos

Qual dessas situações é a sua?`,
    options: [
      { label: "Depositei menos de R$ 50", value: "DEPOSIT_MIN" },
      { label: "Valor creditado diferente", value: "DEPOSIT_DIFF" },
      { label: "⬅️ Voltar", value: "DEPOSIT" },
    ],
  },
  DEPOSIT_MIN: {
    message: `{name}, como o valor foi abaixo do mínimo de R$ 50, ele será estornado automaticamente para sua conta em até 24 horas. 

Não se preocupe, o dinheiro volta certinho! 💚

Ficou claro?`,
    options: [
      { label: "✅ Sim, obrigado!", value: "RESOLVED" },
      { label: "❌ Ainda tenho dúvidas", value: "TICKET_DEPOSIT" },
    ],
  },
  DEPOSIT_DIFF: {
    message: `{name}, se o valor creditado foi diferente do que você esperava, pode ser:

• O valor do PIX foi diferente do selecionado (creditamos o valor real)
• Pode haver um bônus aplicado automaticamente
• Verifique o extrato completo na área de transações

Conseguiu verificar?`,
    options: [
      { label: "✅ Encontrei, obrigado!", value: "RESOLVED" },
      { label: "🔍 Não encontrei", value: "TICKET_DEPOSIT" },
    ],
  },
  DEPOSIT_DOUBT: {
    message: `{name}, te explico certinho como funciona o depósito: 📚

1️⃣ Vá em "Depósito" no menu
2️⃣ Selecione o valor desejado (mín. R$ 50)
3️⃣ Um QR Code PIX será gerado
4️⃣ Escaneie ou copie o código no seu banco
5️⃣ Após pagar, o saldo cai em até 15 min

Simples assim! Alguma dúvida específica?`,
    options: [
      { label: "✅ Entendi tudo!", value: "RESOLVED" },
      { label: "🤔 Ainda tenho dúvidas", value: "TICKET_DEPOSIT" },
    ],
  },
  WITHDRAW: {
    message: `{name}, vamos falar sobre saques! 💸

Informações importantes:

📌 Valor mínimo: R$ 100,00
📌 Prazo de processamento: até 72h úteis
📌 Primeiro saque passa por verificação de segurança
📌 KYC aprovado é obrigatório

Qual sua situação?`,
    options: [
      { label: "Meu saque está em análise", value: "WITHDRAW_PENDING" },
      { label: "Saque está demorando muito", value: "WITHDRAW_DELAY" },
      { label: "Quero saber os prazos", value: "WITHDRAW_INFO" },
      { label: "⬅️ Voltar ao menu", value: "GREETING" },
    ],
  },
  WITHDRAW_PENDING: {
    message: `{name}, se seu saque está em análise, significa que está na fila de processamento. 📋

O processamento leva até 72h úteis, e o primeiro saque passa por uma verificação de segurança. Isso protege você e a plataforma!

Seu KYC (verificação de identidade) está aprovado?`,
    options: [
      { label: "✅ Sim, está aprovado", value: "WITHDRAW_KYC_OK" },
      { label: "❌ Não sei / Não fiz", value: "KYC" },
      { label: "⬅️ Voltar", value: "WITHDRAW" },
    ],
  },
  WITHDRAW_KYC_OK: {
    message: `Perfeito, {name}! Com KYC aprovado, seu saque será processado dentro do prazo normal. ⏳

Prazo de processamento: até 72h úteis

Recomendo aguardar o prazo completo. Você será notificado assim que for processado!

Te ajudei?`,
    options: [
      { label: "✅ Sim, vou aguardar!", value: "RESOLVED" },
      { label: "⏰ Já passou do prazo", value: "WITHDRAW_LATE" },
    ],
  },
  WITHDRAW_LATE: {
    message: `{name}, se já passou do prazo e seu saque ainda não foi processado, vamos registrar para análise prioritária. 🔍

Nossa equipe vai verificar o status e te dar um retorno o mais rápido possível.

Quer que eu registre seu caso?`,
    options: [
      { label: "✅ Sim, registrar meu caso", value: "TICKET_WITHDRAW" },
      { label: "🔄 Vou aguardar mais um pouco", value: "WITHDRAW" },
    ],
  },
  WITHDRAW_DELAY: {
    message: `{name}, atrasos podem acontecer por alguns motivos:

• Alto volume de solicitações
• Verificação adicional de segurança
• Dados bancários desatualizados
• KYC pendente

Verifique se seus dados PIX estão corretos no perfil!`,
    options: [
      { label: "✅ Vou verificar", value: "RESOLVED" },
      { label: "📋 Dados estão corretos", value: "WITHDRAW_LATE" },
      { label: "⬅️ Voltar", value: "WITHDRAW" },
    ],
  },
  WITHDRAW_INFO: {
    message: `{name}, aqui estão todos os prazos de saque: 📋

🔹 Processamento: até 72 horas úteis
🔹 Primeiro saque: verificação de segurança adicional
🔹 Contas VIP: processamento prioritário

Os prazos contam apenas em dias úteis (seg-sex).

Ficou claro?`,
    options: [
      { label: "✅ Sim, entendi!", value: "RESOLVED" },
      { label: "⬅️ Voltar", value: "WITHDRAW" },
    ],
  },
  KYC: {
    message: `{name}, a verificação de conta (KYC) é super importante para sua segurança! 🔐

⏰ Tempo médio para aprovação: até 72 horas

É um processo simples:
1️⃣ Envie foto do documento (RG ou CNH)
2️⃣ Tire uma selfie segurando o documento
3️⃣ Aguarde a análise

Qual sua situação com o KYC?`,
    options: [
      { label: "Já enviei e estou aguardando", value: "KYC_WAITING" },
      { label: "⏰ Já passou de 72 horas", value: "KYC_PASSED_TIME" },
      { label: "Ainda não fiz", value: "KYC_NOT_DONE" },
      { label: "Foi rejeitado", value: "KYC_REJECTED" },
      { label: "⬅️ Voltar ao menu", value: "GREETING" },
    ],
  },
  KYC_WAITING: {
    message: `{name}, se você já enviou os documentos, eles estão em análise! ⏳

⏰ Prazo normal: até 72 horas úteis.

Durante a análise:
✅ Você pode continuar operando
✅ Depósitos funcionam normalmente
⏸️ Saques ficam bloqueados até aprovação

Te ajudei?`,
    options: [
      { label: "✅ Sim, vou aguardar!", value: "RESOLVED" },
      { label: "⏰ Já passou de 72h", value: "KYC_PASSED_TIME" },
    ],
  },
  KYC_PASSED_TIME: {
    message: `{name}, entendo sua situação. Se já passou de 72 horas, vou precisar de alguns dados adicionais para análise prioritária.

Por favor, informe seu nome completo:`,
    input: true,
    inputPlaceholder: "Digite seu nome completo...",
  },
  KYC_BIRTH_DATE: {
    message: `Obrigado, {name}. Agora preciso da sua data de nascimento:`,
    input: true,
    inputPlaceholder: "DD/MM/AAAA",
  },
  KYC_MOTHER_NAME: {
    message: `Certo. Qual o nome completo da sua mãe?`,
    input: true,
    inputPlaceholder: "Nome completo da mãe...",
  },
  KYC_FATHER_NAME: {
    message: `Por último, qual o nome completo do seu pai?`,
    input: true,
    inputPlaceholder: "Nome completo do pai...",
  },
  KYC_ANALYZING: {
    message: `Perfeito, {name}! Recebi todas as informações. ✅

🔍 Iniciando análise da sua conta...
⏳ Aguarde enquanto verifico o sistema...`,
    options: [],
  },
  KYC_ANALYSIS_RESULT: {
    message: `{name}, nossa análise detectou algo anormal no sistema de cadastro da sua conta. ⚠️

Por questões de segurança e conformidade, seu caso foi encaminhado para análise jurídica da nossa equipe de compliance.

📋 Status: Em análise jurídica
⏰ Prazo: até 7 dias úteis
📧 Você receberá atualizações por e-mail/WhatsApp

Nossa equipe está trabalhando para resolver isso o mais rápido possível.`,
    options: [
      { label: "✅ Entendi", value: "FINAL" },
      { label: "📝 Tenho outra dúvida", value: "GREETING" },
    ],
  },
  OTHER: {
    message: `{name}, me conta mais sobre o que você precisa! 🤔

Descreva sua situação para que eu possa te ajudar melhor ou encaminhar para a equipe correta.`,
    options: [
      { label: "📋 Registrar meu caso", value: "TICKET_OTHER" },
      { label: "⬅️ Voltar ao menu", value: "GREETING" },
    ],
  },
  TICKET_DEPOSIT: {
    message: `{name}, registrei seu caso sobre depósitos! ✅

📋 Protocolo gerado automaticamente
📧 Nossa equipe receberá todas as informações
⏰ Prazo de resposta: até 72 horas

Você receberá a resposta por e-mail ou WhatsApp cadastrado assim que nossa equipe analisar seu caso.

Posso ajudar em mais alguma coisa?`,
    options: [
      { label: "✅ Não, obrigado!", value: "FINAL" },
      { label: "📝 Tenho outra dúvida", value: "GREETING" },
    ],
  },
  TICKET_WITHDRAW: {
    message: `{name}, registrei seu caso sobre saque! ✅

📋 Protocolo gerado automaticamente
📧 Nossa equipe receberá todas as informações
⏰ Prazo de resposta: até 72 horas

Você receberá a resposta por e-mail ou WhatsApp cadastrado assim que nossa equipe analisar seu caso.

Posso ajudar em mais alguma coisa?`,
    options: [
      { label: "✅ Não, obrigado!", value: "FINAL" },
      { label: "📝 Tenho outra dúvida", value: "GREETING" },
    ],
  },
  TICKET_KYC: {
    message: `{name}, registrei seu caso sobre verificação! ✅

📋 Protocolo gerado automaticamente
📧 Nossa equipe receberá todas as informações
⏰ Prazo de resposta: até 72 horas

Você receberá a resposta por e-mail ou WhatsApp cadastrado assim que nossa equipe analisar seu caso.

Posso ajudar em mais alguma coisa?`,
    options: [
      { label: "✅ Não, obrigado!", value: "FINAL" },
      { label: "📝 Tenho outra dúvida", value: "GREETING" },
    ],
  },
  TICKET_TRADE: {
    message: `{name}, registrei seu caso sobre operações! ✅

📋 Protocolo gerado automaticamente
📧 Nossa equipe receberá todas as informações
⏰ Prazo de resposta: até 72 horas

Você receberá a resposta por e-mail ou WhatsApp cadastrado assim que nossa equipe analisar seu caso.

Posso ajudar em mais alguma coisa?`,
    options: [
      { label: "✅ Não, obrigado!", value: "FINAL" },
      { label: "📝 Tenho outra dúvida", value: "GREETING" },
    ],
  },
  TICKET_TECH: {
    message: `{name}, registrei seu caso técnico! ✅

📋 Protocolo gerado automaticamente
📧 Nossa equipe receberá todas as informações
⏰ Prazo de resposta: até 72 horas

Você receberá a resposta por e-mail ou WhatsApp cadastrado assim que nossa equipe analisar seu caso.

Posso ajudar em mais alguma coisa?`,
    options: [
      { label: "✅ Não, obrigado!", value: "FINAL" },
      { label: "📝 Tenho outra dúvida", value: "GREETING" },
    ],
  },
  TICKET_OTHER: {
    message: `{name}, registrei seu caso! ✅

📋 Protocolo gerado automaticamente
📧 Nossa equipe receberá todas as informações
⏰ Prazo de resposta: até 72 horas

Você receberá a resposta por e-mail ou WhatsApp cadastrado assim que nossa equipe analisar seu caso.

Posso ajudar em mais alguma coisa?`,
    options: [
      { label: "✅ Não, obrigado!", value: "FINAL" },
      { label: "📝 Tenho outra dúvida", value: "GREETING" },
    ],
  },
  RESOLVED: {
    message: `Que bom que consegui te ajudar, {name}! 🎉

Se tiver outras dúvidas no futuro, é só voltar aqui que estarei pronto para ajudar.

Boas operações! 🚀`,
    options: [
      { label: "📝 Tenho outra dúvida", value: "GREETING" },
      { label: "📈 Voltar para o Trade", value: "GO_TRADE" },
    ],
  },
  RESOLVED_WAIT: {
    message: `Perfeito, {name}! Aguarde mais alguns minutos que deve cair. ⏳

Se passar de 15 minutos e não aparecer, volte aqui que te ajudo a registrar o caso.

Boa sorte nas operações! 🍀`,
    options: [
      { label: "📝 Tenho outra dúvida", value: "GREETING" },
      { label: "📈 Voltar para o Trade", value: "GO_TRADE" },
    ],
  },
  FINAL: {
    message: `Foi um prazer te ajudar, {name}! 💚

Lembre-se: a resposta da equipe chegará no seu e-mail ou WhatsApp em até 72 horas.

Até a próxima e boas operações! 🚀`,
    options: [{ label: "📈 Ir para o Trade", value: "GO_TRADE" }],
  },
}

interface Message {
  id: string
  type: "bot" | "user" | "typing"
  content: string
  options?: { label: string; value: string }[]
  input?: boolean
  inputPlaceholder?: string
  showTimer?: boolean
}

export default function SupportPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [currentStep, setCurrentStep] = useState("START")
  const [userName, setUserName] = useState("")
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [showOptions, setShowOptions] = useState(true)
  const [kycData, setKycData] = useState({
    fullName: "",
    birthDate: "",
    motherName: "",
    fatherName: "",
  })
  const [analysisTimer, setAnalysisTimer] = useState(180)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  useEffect(() => {
    const initialFlow = supportFlow.START
    setMessages([
      {
        id: "1",
        type: "bot",
        content: initialFlow.message,
        options: initialFlow.options,
        input: initialFlow.input,
        inputPlaceholder: initialFlow.inputPlaceholder,
      },
    ])
  }, [])

  const replaceNamePlaceholder = (text: string) => {
    return text.replace(/{name}/g, userName || "você")
  }

  const addBotMessageWithTyping = (botMessage: Message) => {
    setIsTyping(true)
    setShowOptions(false)

    setTimeout(() => {
      setIsTyping(false)
      setMessages((prev) => [...prev, botMessage])
      setShowOptions(true)
    }, 2000)
  }

  const handleInputSubmit = () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue.trim(),
    }
    setMessages((prev) => [...prev, userMessage])

    if (currentStep === "START") {
      const name = inputValue.trim()
      setUserName(name)

      const nextFlow = supportFlow.GREETING
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: nextFlow.message.replace(/{name}/g, name),
        options: nextFlow.options,
      }

      addBotMessageWithTyping(botMessage)
      setCurrentStep("GREETING")
      setInputValue("")
      return
    }

    if (currentStep === "KYC_PASSED_TIME") {
      const fullName = inputValue.trim()
      setKycData((prev) => ({ ...prev, fullName }))

      const nextFlow = supportFlow.KYC_BIRTH_DATE
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: replaceNamePlaceholder(nextFlow.message),
        input: nextFlow.input,
        inputPlaceholder: nextFlow.inputPlaceholder,
      }

      addBotMessageWithTyping(botMessage)
      setCurrentStep("KYC_BIRTH_DATE")
      setInputValue("")
      return
    }

    if (currentStep === "KYC_BIRTH_DATE") {
      const birthDate = inputValue.trim()
      setKycData((prev) => ({ ...prev, birthDate }))

      const nextFlow = supportFlow.KYC_MOTHER_NAME
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: replaceNamePlaceholder(nextFlow.message),
        input: nextFlow.input,
        inputPlaceholder: nextFlow.inputPlaceholder,
      }

      addBotMessageWithTyping(botMessage)
      setCurrentStep("KYC_MOTHER_NAME")
      setInputValue("")
      return
    }

    if (currentStep === "KYC_MOTHER_NAME") {
      const motherName = inputValue.trim()
      setKycData((prev) => ({ ...prev, motherName }))

      const nextFlow = supportFlow.KYC_FATHER_NAME
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: replaceNamePlaceholder(nextFlow.message),
        input: nextFlow.input,
        inputPlaceholder: nextFlow.inputPlaceholder,
      }

      addBotMessageWithTyping(botMessage)
      setCurrentStep("KYC_FATHER_NAME")
      setInputValue("")
      return
    }

    if (currentStep === "KYC_FATHER_NAME") {
      const fatherName = inputValue.trim()
      setKycData((prev) => ({ ...prev, fatherName }))

      const nextFlow = supportFlow.KYC_ANALYZING
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: replaceNamePlaceholder(nextFlow.message),
        showTimer: true,
      }

      addBotMessageWithTyping(botMessage)
      setCurrentStep("KYC_ANALYZING")
      setInputValue("")
      setIsAnalyzing(true)
      return
    }

    setInputValue("")
  }

  const handleOptionClick = (option: { label: string; value: string }) => {
    if (option.value === "GO_TRADE") {
      router.push("/trade")
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: option.label,
    }

    setMessages((prev) => [...prev, userMessage])

    const nextFlow = supportFlow[option.value]
    if (nextFlow) {
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: replaceNamePlaceholder(nextFlow.message),
        options: nextFlow.options,
        input: nextFlow.input,
        inputPlaceholder: nextFlow.inputPlaceholder,
      }

      addBotMessageWithTyping(botMessage)
      setCurrentStep(option.value)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  useEffect(() => {
    if (isAnalyzing && analysisTimer > 0) {
      const interval = setInterval(() => {
        setAnalysisTimer((prev) => prev - 1)
      }, 1000)

      return () => clearInterval(interval)
    } else if (isAnalyzing && analysisTimer === 0) {
      setIsAnalyzing(false)
      const nextFlow = supportFlow.KYC_ANALYSIS_RESULT
      const botMessage: Message = {
        id: Date.now().toString(),
        type: "bot",
        content: replaceNamePlaceholder(nextFlow.message),
        options: nextFlow.options,
      }
      addBotMessageWithTyping(botMessage)
      setCurrentStep("KYC_ANALYSIS_RESULT")
      setAnalysisTimer(180)
    }
  }, [isAnalyzing, analysisTimer, userName])

  const lastBotMessage = [...messages].reverse().find((m) => m.type === "bot")
  const needsInput = lastBotMessage?.input && !isTyping

  return (
    <div className="min-h-screen bg-[#0D1117] flex flex-col">
      <header className="bg-[#161B22] border-b border-[#30363D] px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-[#30363D]">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#fb923c] to-[#f97316] flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold">Suporte URYN BROKER</h1>
            <p className="text-xs text-[#fb923c]">{isTyping ? "Digitando..." : "Online agora"}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message, index) => {
          const isLastBotMessage = message.type === "bot" && index === messages.length - 1

          return (
            <div key={message.id}>
              {message.type === "bot" && (
                <div className="flex gap-2 items-start">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#fb923c] to-[#f97316] flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 max-w-[85%]">
                    <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-[#1a2332]">
                      <p className="text-gray-200 text-sm whitespace-pre-line leading-relaxed">{message.content}</p>

                      {message.showTimer && (
                        <div className="mt-3 flex items-center gap-2 text-[#fb923c]">
                          <Clock className="w-4 h-4 animate-pulse" />
                          <span className="text-sm font-mono">{formatTime(analysisTimer)}</span>
                          <span className="text-xs text-gray-400">Analisando...</span>
                        </div>
                      )}
                    </div>

                    {isLastBotMessage && showOptions && message.options && message.options.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {message.options.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => handleOptionClick(option)}
                            className="w-full text-left px-4 py-3 rounded-xl text-sm text-gray-200 bg-[#0f1419] hover:bg-[#fb923c]/20 border border-[#30363D] hover:border-[#fb923c]/50 transition-all duration-200 active:scale-[0.98]"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {message.type === "user" && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3 bg-gradient-to-r from-[#fb923c] to-[#f97316]">
                    <p className="text-white text-sm">{message.content}</p>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {isTyping && (
          <div className="flex gap-2 items-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#fb923c] to-[#f97316] flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-[#1a2332]">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {needsInput && (
        <div className="bg-[#161B22] border-t border-[#30363D] px-4 py-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInputSubmit()}
              placeholder={lastBotMessage?.inputPlaceholder || "Digite aqui..."}
              className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#fb923c] transition-colors"
              autoFocus
            />
            <Button
              onClick={handleInputSubmit}
              disabled={!inputValue.trim()}
              className="bg-gradient-to-r from-[#fb923c] to-[#f97316] hover:opacity-90 text-white px-4 rounded-xl disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {!needsInput && (
        <div className="bg-[#161B22] border-t border-[#30363D] px-4 py-3">
          <p className="text-center text-xs text-[#6B7280]">
            Atendimento automatizado 24/7 • Casos registrados são respondidos em até 72h
          </p>
        </div>
      )}
    </div>
  )
}

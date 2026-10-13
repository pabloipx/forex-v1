// Configuração centralizada com fallbacks seguros para Vercel Serverless
// Nenhuma variável de ambiente é obrigatória - tudo tem fallback

export const config = {
  // Supabase - fallback para strings vazias (não vai conectar, mas não vai crashar)
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
    // Somente servidor: em código de cliente este valor é sempre "".
    secretKey: process.env.SUPABASE_SECRET_KEY || "",
    get isConfigured() {
      return !!(this.url && this.publishableKey)
    },
    get isAdminConfigured() {
      return !!(this.url && this.secretKey)
    },
  },

  // AmploPay
  // As DUAS credenciais vem do ambiente e devem ser do MESMO par/conta:
  //   AMPLOPAY_PUBLIC_KEY     -> Chave Pública (Client ID)
  //   AMPLOPAY_SECRET_KEY_V2  -> Chave Privada (Client Secret)
  //
  // A chave publica fixa que existia aqui foi removida. Alem de ser credencial no fonte, ela
  // quebrava o isConfigured abaixo: como publicKey nunca ficava vazia, a checagem passava mesmo
  // com a conta errada configurada, e so a secreta era de fato verificada.
  amplopay: {
    baseUrl: process.env.AMPLOPAY_BASE_URL || "https://app.amplopay.com/api/v1",
    publicKey: process.env.AMPLOPAY_PUBLIC_KEY || "",
    secretKey: process.env.AMPLOPAY_SECRET_KEY_V2 || "",
    get isConfigured() {
      return !!(this.publicKey && this.secretKey)
    },
  },

  // Admin
  //
  // O painel administrativo autentica por cookie HttpOnly assinado (lib/admin/session.ts).
  // O fallback de senha que existia aqui era uma credencial no fonte e, por ser lida
  // tambem em componentes de cliente, era publicada no bundle enviado ao navegador.
  admin: {
    email: process.env.ADMIN_EMAIL || "",
    get isConfigured() {
      return !!(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD)
    },
  },

  // App
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    isDev: process.env.NODE_ENV === "development",
    isProd: process.env.NODE_ENV === "production",
  },
}

// Helper para verificar se o ambiente está configurado
export function isEnvironmentReady(): boolean {
  return config.supabase.isConfigured
}

// Helper para criar resposta de erro controlada
export function createErrorResponse(message: string, status: number = 500) {
  return new Response(JSON.stringify({ error: message, success: false }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// Helper para criar resposta de sucesso
export function createSuccessResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify({ ...data, success: true }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

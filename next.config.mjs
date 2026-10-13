/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Headers de seguranca (defesa em profundidade). Aplicam-se ao app publicado; o preview do v0
  // remove os de enquadramento para conseguir renderizar no iframe.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Impede o navegador de "adivinhar" o tipo de arquivo (evita ataques por MIME sniffing).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Nao vaza a URL completa (com querystrings sensiveis) para sites de terceiros.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Forca HTTPS por 2 anos apos a primeira visita.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // App com login e saldo: bloqueia que outro site coloque a corretora dentro de um
          // iframe (protege contra clickjacking / roubo de sessao por sobreposicao).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Desliga recursos sensiveis do dispositivo que a corretora nao usa.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ]
  },
}

export default nextConfig

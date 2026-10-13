export interface MarketStatus {
  /** true = pode operar; false = mercado fechado */
  open: boolean
  /** motivo curto quando fechado (para exibir na UI) */
  reason?: string
  /** próxima abertura (quando fechado) */
  nextOpen?: Date
  /** próximo fechamento (quando aberto e o mercado tem hora de fechar) */
  nextClose?: Date
}

/**
 * Margem de segurança antes do fechamento. Uma operação precisa de preço real no vencimento;
 * se expirar exatamente na virada, o feed já parou e não há cotação para liquidar.
 */
const CLOSE_BUFFER_SECONDS = 30

/**
 * Janela de funcionamento do "Mercado aberto": segunda a sexta, das 08:00 às 18:00
 * no horário de Brasília (America/Sao_Paulo). Fora disso (noite, madrugada e fins de
 * semana) os ativos ficam bloqueados.
 *
 * Cripto opera 24/7. OTC está sempre disponível.
 *
 * Todo o cálculo é feito em horário de Brasília, independentemente do fuso do dispositivo
 * ou do servidor.
 */
const MARKET_OPEN_HOUR = 8 // 08:00 (Brasília)
const MARKET_CLOSE_HOUR = 18 // 18:00 (Brasília)
/** Brasília não observa horário de verão desde 2019: offset fixo de UTC-3. */
const BR_OFFSET_HOURS = 3

/** Partes do relógio de parede de Brasília para um instante qualquer. */
function brasiliaParts(now: Date): { year: number; month: number; day: number; hour: number; weekday: number } {
  // Deslocamento fixo -3h a partir do UTC.
  const shifted = new Date(now.getTime() - BR_OFFSET_HOURS * 60 * 60 * 1000)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    weekday: shifted.getUTCDay(), // 0 = domingo ... 6 = sábado
  }
}

/** Constrói um Date (UTC real) a partir de uma hora de parede de Brasília. */
function fromBrasilia(year: number, month: number, day: number, hour: number): Date {
  return new Date(Date.UTC(year, month, day, hour + BR_OFFSET_HOURS, 0, 0, 0))
}

export function getMarketStatus(
  asset: { market?: string; category?: string } | undefined,
  now: Date = new Date(),
): MarketStatus {
  // Sem info do ativo ou ativo OTC: sempre disponível.
  if (!asset || asset.market !== "open") return { open: true }

  // Todos os ativos da aba "Mercado aberto" — inclusive cripto como BTC/USD — seguem a
  // mesma janela: Seg–Sex, 08:00–18:00 (Brasília). Cripto so opera 24h na versao OTC.
  const { weekday, hour } = brasiliaParts(now)
  const isWeekday = weekday >= 1 && weekday <= 5
  const isWithinHours = hour >= MARKET_OPEN_HOUR && hour < MARKET_CLOSE_HOUR

  if (isWeekday && isWithinHours) {
    return { open: true, nextClose: getNextMarketClose(now) }
  }

  return {
    open: false,
    reason: weekday === 0 || weekday === 6 ? "Mercado fechado (fim de semana)" : "Mercado fechado (fora do horário)",
    nextOpen: getNextMarketOpen(now),
  }
}

/** Próximo fechamento: 18:00 (Brasília) do dia útil em que o mercado está aberto. */
function getNextMarketClose(now: Date): Date {
  const { year, month, day } = brasiliaParts(now)
  return fromBrasilia(year, month, day, MARKET_CLOSE_HOUR)
}

/** Próxima abertura: 08:00 (Brasília) do próximo dia útil (ou de hoje, se ainda antes das 08:00). */
function getNextMarketOpen(now: Date): Date {
  const { year, month, day, hour, weekday } = brasiliaParts(now)

  // Ainda é dia útil e antes das 08:00 → abre hoje às 08:00.
  if (weekday >= 1 && weekday <= 5 && hour < MARKET_OPEN_HOUR) {
    return fromBrasilia(year, month, day, MARKET_OPEN_HOUR)
  }

  // Caso contrário, avança para o próximo dia útil às 08:00.
  let offset = 1
  let nextWeekday = (weekday + offset) % 7
  while (nextWeekday === 0 || nextWeekday === 6) {
    offset += 1
    nextWeekday = (weekday + offset) % 7
  }
  return fromBrasilia(year, month, day + offset, MARKET_OPEN_HOUR)
}

export interface TradeWindowCheck {
  /** true = a entrada pode ser aberta */
  allowed: boolean
  /** motivo curto quando bloqueada (para exibir na UI) */
  reason?: string
}

/**
 * Verifica se uma entrada pode ser aberta agora, considerando a duração escolhida.
 *
 * Bloqueia em dois casos: mercado já fechado, ou mercado aberto mas a operação venceria
 * depois do fechamento — situação em que não existiria preço real para liquidar.
 */
export function canOpenTrade(
  asset: { market?: string; category?: string } | undefined,
  durationSeconds: number,
  now: Date = new Date(),
): TradeWindowCheck {
  const status = getMarketStatus(asset, now)
  if (!status.open) {
    return { allowed: false, reason: status.reason || "Mercado fechado" }
  }

  if (status.nextClose) {
    const expiresAt = now.getTime() + durationSeconds * 1000
    const limit = status.nextClose.getTime() - CLOSE_BUFFER_SECONDS * 1000
    if (expiresAt > limit) {
      return { allowed: false, reason: "Mercado fechando: a operação venceria após o fechamento" }
    }
  }

  return { allowed: true }
}


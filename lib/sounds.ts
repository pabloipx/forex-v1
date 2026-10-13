// Trade sound effects using Web Audio API - no audio files needed
let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume()
    }
    return audioCtx
  } catch {
    return null
  }
}

// Desbloqueia/inicializa o AudioContext no primeiro gesto do usuario.
// Navegadores (especialmente mobile) so permitem criar/retomar audio dentro de um gesto.
// Chamar isso uma vez garante que o primeiro som de entrada toque de forma confiavel.
export function unlockAudio() {
  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === "suspended") ctx.resume()
}

function playTone(freq: number, duration: number, type: OscillatorType = "sine", volume = 0.3) {
  const ctx = getCtx()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(freq, ctx.currentTime)

  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + duration)
}

// CALL/BUY sound - ascending double beep (positive feel)
export function playCallSound() {
  const ctx = getCtx()
  if (!ctx) return

  // First beep
  playTone(880, 0.12, "sine", 0.25)

  // Second higher beep after 100ms
  setTimeout(() => {
    playTone(1174, 0.15, "sine", 0.3)
  }, 100)
}

// PUT/SELL sound - descending double beep
export function playPutSound() {
  const ctx = getCtx()
  if (!ctx) return

  // First beep
  playTone(784, 0.12, "sine", 0.25)

  // Second lower beep after 100ms
  setTimeout(() => {
    playTone(587, 0.15, "sine", 0.3)
  }, 100)
}

// WIN sound - cheerful ascending arpeggio
export function playWinSound() {
  const ctx = getCtx()
  if (!ctx) return

  const notes = [523, 659, 784, 1047] // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.18, "sine", 0.2), i * 80)
  })
}

// LOSS sound - low descending tone
export function playLossSound() {
  const ctx = getCtx()
  if (!ctx) return

  playTone(330, 0.3, "triangle", 0.2)
  setTimeout(() => playTone(262, 0.4, "triangle", 0.15), 150)
}

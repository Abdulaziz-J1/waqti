/**
 * An original, synthesized chime (no recording, no adhan): three soft sine
 * tones rising a major triad with a slow bell-like decay. Plays once.
 */
export function playChime(volume = 0.16): void {
  try {
    const ctx = new AudioContext()
    const master = ctx.createGain()
    master.gain.value = volume
    master.connect(ctx.destination)
    const start = ctx.currentTime + 0.05
    const notes = [523.25, 659.25, 783.99]
    notes.forEach((freq, i) => {
      const t0 = start + i * 0.42
      for (const [mult, level] of [
        [1, 1],
        [2, 0.12],
        [3, 0.04]
      ] as const) {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq * mult
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.0001, t0)
        env.gain.exponentialRampToValueAtTime(level, t0 + 0.04)
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.2)
        osc.connect(env)
        env.connect(master)
        osc.start(t0)
        osc.stop(t0 + 3.3)
      }
    })
    setTimeout(() => void ctx.close(), 5500)
  } catch {
    // Audio is optional; the lock works without it.
  }
}

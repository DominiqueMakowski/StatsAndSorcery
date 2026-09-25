// Tiny synthesised sound effects: pencil scratches, whooshes and pops. No audio files.

export type SfxName = "scribble" | "pop" | "whoosh" | "hit" | "miss" | "block" | "page" | "win" | "lose" | "poof" | "buff" | "hop" | "land"

const STORAGE_KEY = "sas.muted"

class Sfx {
    private ctx: AudioContext | null = null
    private noiseBuffer: AudioBuffer | null = null
    muted = false

    constructor() {
        try {
            this.muted = localStorage.getItem(STORAGE_KEY) === "1"
        } catch {
            this.muted = false
        }
    }

    toggle(): boolean {
        this.muted = !this.muted
        try {
            localStorage.setItem(STORAGE_KEY, this.muted ? "1" : "0")
        } catch {
            // Private mode: nothing to persist.
        }
        if (!this.muted) this.play("pop")
        return this.muted
    }

    private get ac(): AudioContext | null {
        if (typeof AudioContext === "undefined") return null
        if (!this.ctx) this.ctx = new AudioContext()
        if (this.ctx.state === "suspended") void this.ctx.resume()
        return this.ctx
    }

    private noise(ac: AudioContext): AudioBufferSourceNode {
        if (!this.noiseBuffer) {
            this.noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
            const data = this.noiseBuffer.getChannelData(0)
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
        }
        const src = ac.createBufferSource()
        src.buffer = this.noiseBuffer
        src.loop = true
        return src
    }

    /** Filtered noise with an envelope: scratches, whooshes, puffs. */
    private hiss(opts: { duration: number; type: BiquadFilterType; from: number; to?: number; gain: number; q?: number; delay?: number }) {
        const ac = this.ac
        if (!ac) return
        const t0 = ac.currentTime + (opts.delay ?? 0)
        const src = this.noise(ac)
        const filter = ac.createBiquadFilter()
        filter.type = opts.type
        filter.frequency.setValueAtTime(opts.from, t0)
        if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.duration)
        filter.Q.value = opts.q ?? 1
        const g = ac.createGain()
        g.gain.setValueAtTime(0.0001, t0)
        g.gain.exponentialRampToValueAtTime(opts.gain, t0 + 0.015)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration)
        src.connect(filter).connect(g).connect(ac.destination)
        src.start(t0)
        src.stop(t0 + opts.duration + 0.05)
    }

    /** A simple oscillator note. */
    private tone(opts: { freq: number; to?: number; duration: number; type?: OscillatorType; gain?: number; delay?: number }) {
        const ac = this.ac
        if (!ac) return
        const t0 = ac.currentTime + (opts.delay ?? 0)
        const osc = ac.createOscillator()
        osc.type = opts.type ?? "triangle"
        osc.frequency.setValueAtTime(opts.freq, t0)
        if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.duration)
        const g = ac.createGain()
        const peak = opts.gain ?? 0.12
        g.gain.setValueAtTime(0.0001, t0)
        g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration)
        osc.connect(g).connect(ac.destination)
        osc.start(t0)
        osc.stop(t0 + opts.duration + 0.05)
    }

    play(name: SfxName) {
        if (this.muted) return
        try {
            switch (name) {
                case "scribble":
                    // Three quick pencil strokes.
                    for (let i = 0; i < 3; i++) this.hiss({ duration: 0.07, type: "bandpass", from: 2600 + i * 400, gain: 0.09, q: 2, delay: i * 0.06 })
                    break
                case "pop":
                    this.tone({ freq: 520, to: 880, duration: 0.09, type: "sine", gain: 0.1 })
                    break
                case "buff":
                    this.tone({ freq: 660, to: 990, duration: 0.14, type: "triangle", gain: 0.08 })
                    this.tone({ freq: 990, to: 1320, duration: 0.14, type: "triangle", gain: 0.06, delay: 0.09 })
                    break
                case "whoosh":
                    this.hiss({ duration: 0.4, type: "lowpass", from: 300, to: 2400, gain: 0.12, q: 0.7 })
                    break
                case "hit":
                    this.tone({ freq: 150, to: 50, duration: 0.18, type: "square", gain: 0.12 })
                    this.hiss({ duration: 0.12, type: "lowpass", from: 1800, to: 200, gain: 0.16 })
                    break
                case "miss":
                    this.hiss({ duration: 0.22, type: "lowpass", from: 900, to: 300, gain: 0.07 })
                    break
                case "block":
                    this.tone({ freq: 420, to: 380, duration: 0.12, type: "square", gain: 0.07 })
                    this.hiss({ duration: 0.1, type: "highpass", from: 3000, gain: 0.08 })
                    break
                case "poof":
                    this.hiss({ duration: 0.18, type: "bandpass", from: 800, to: 300, gain: 0.08, q: 1.5 })
                    break
                case "hop":
                    // A springy boing up, and the swish of a robe.
                    this.tone({ freq: 260, to: 620, duration: 0.18, type: "sine", gain: 0.09 })
                    this.hiss({ duration: 0.3, type: "bandpass", from: 500, to: 1400, gain: 0.05, q: 0.9 })
                    break
                case "land":
                    // A soft thump of shoes on paper.
                    this.tone({ freq: 170, to: 80, duration: 0.12, type: "sine", gain: 0.12 })
                    this.hiss({ duration: 0.12, type: "lowpass", from: 900, to: 200, gain: 0.07 })
                    break
                case "page":
                    this.hiss({ duration: 0.35, type: "bandpass", from: 1200, to: 2200, gain: 0.07, q: 0.8 })
                    break
                case "win":
                    for (const [i, f] of [523, 659, 784, 1047].entries()) this.tone({ freq: f, duration: 0.25, type: "triangle", gain: 0.1, delay: i * 0.12 })
                    break
                case "lose":
                    this.tone({ freq: 392, to: 300, duration: 0.3, type: "triangle", gain: 0.09 })
                    this.tone({ freq: 300, to: 200, duration: 0.45, type: "triangle", gain: 0.09, delay: 0.25 })
                    break
            }
        } catch {
            // Audio is a garnish; never let it break the game.
        }
    }
}

export const sfx = new Sfx()

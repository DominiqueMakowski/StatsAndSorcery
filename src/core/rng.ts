// Seeded pseudo-random numbers, so duels (and tests) are reproducible.

export interface Rng {
    /** Uniform in [0, 1). */
    next(): number
    /** Standard normal draw, N(0, 1). */
    normal(): number
}

/** Mulberry32: tiny, fast, good enough for games. */
export function createRng(seed: number): Rng {
    let state = seed >>> 0
    let spare: number | null = null

    const next = () => {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    // Box–Muller, caching the second value of each pair.
    const normal = () => {
        if (spare !== null) {
            const s = spare
            spare = null
            return s
        }
        let u = 0
        while (u === 0) u = next()
        const v = next()
        const r = Math.sqrt(-2 * Math.log(u))
        spare = r * Math.sin(2 * Math.PI * v)
        return r * Math.cos(2 * Math.PI * v)
    }

    return { next, normal }
}

export function randomSeed(): number {
    return Math.floor(Math.random() * 2 ** 32)
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
}

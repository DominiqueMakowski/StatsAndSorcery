export const ease = {
    linear: (t: number) => t,
    outCubic: (t: number) => 1 - (1 - t) ** 3,
    inCubic: (t: number) => t ** 3,
    inOutCubic: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
    outBack: (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
}

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * requestAnimationFrame, with a timer fallback: some embedded browsers stop firing
 * frames when the page is occluded, which would freeze a duel mid-animation.
 */
export function nextFrame(cb: (now: number) => void): void {
    let done = false
    const id = requestAnimationFrame((t) => {
        if (done) return
        done = true
        clearTimeout(timer)
        cb(t)
    })
    const timer = setTimeout(() => {
        if (done) return
        done = true
        cancelAnimationFrame(id)
        cb(performance.now())
    }, 250)
}

/** Run `onUpdate` with eased progress 0 → 1 over `duration` ms. */
export function animate(duration: number, onUpdate: (t: number) => void, easing = ease.outCubic): Promise<void> {
    if (reducedMotion()) duration = Math.min(duration, 120)
    return new Promise((resolve) => {
        const start = performance.now()
        const step = (now: number) => {
            const raw = Math.min(1, (now - start) / duration)
            onUpdate(easing(raw))
            if (raw < 1) nextFrame(step)
            else resolve()
        }
        nextFrame(step)
    })
}

export function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, reducedMotion() ? Math.min(ms, 120) : ms))
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

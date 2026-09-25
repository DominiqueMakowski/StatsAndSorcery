// Hand-drawn primitives: every line wobbles a little, like ballpoint on paper.
// Shapes are deterministic for a given seed, so the "line boil" (re-seeding a few
// times per second) makes static drawings look alive without them jumping around.

export type Pt = [number, number]

/** Deterministic pseudo-random in [−1, 1] from a seed and an index. */
export function jitter(seed: number, i: number): number {
    let h = (Math.imul(seed | 0, 374761393) + Math.imul(i | 0, 668265263)) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h ^= h >>> 16
    return ((h >>> 0) / 4294967296) * 2 - 1
}

/** Seed that changes ~8 times a second, for "boiling" hand-drawn lines. */
export function boilSeed(time: number, rate = 8): number {
    return Math.floor(time * rate)
}

/** Add a wobbly line to the current path (two slightly different strokes when passes = 2). */
export function roughLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, seed: number, rough = 1, passes = 2) {
    const dx = x1 - x0
    const dy = y1 - y0
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    for (let p = 0; p < passes; p++) {
        const s = seed * 7 + p * 131
        const amp = rough * (p === 0 ? 1 : 0.7)
        const c1 = jitter(s, 1) * amp * 2.2
        const c2 = jitter(s, 2) * amp * 2.2
        const e0 = jitter(s, 3) * amp * 0.6
        const e1 = jitter(s, 4) * amp * 0.6
        ctx.moveTo(x0 + nx * e0, y0 + ny * e0)
        ctx.bezierCurveTo(
            x0 + dx * 0.33 + nx * c1,
            y0 + dy * 0.33 + ny * c1,
            x0 + dx * 0.66 + nx * c2,
            y0 + dy * 0.66 + ny * c2,
            x1 + nx * e1,
            y1 + ny * e1
        )
    }
}

/** Add a wobbly polyline (optionally closed) to the current path. */
export function roughPoly(ctx: CanvasRenderingContext2D, pts: Pt[], seed: number, rough = 1, close = false) {
    if (pts.length < 2) return
    const wob = (i: number): Pt => [pts[i][0] + jitter(seed, i * 2) * rough, pts[i][1] + jitter(seed, i * 2 + 1) * rough]
    const [sx, sy] = wob(0)
    ctx.moveTo(sx, sy)
    for (let i = 1; i < pts.length; i++) {
        const [x, y] = wob(i)
        ctx.lineTo(x, y)
    }
    if (close) {
        // Hand-drawn shapes overshoot a touch where the pen meets its start.
        const [x, y] = wob(0)
        const [x1, y1] = wob(1)
        ctx.lineTo(x, y)
        ctx.lineTo(x + (x1 - x) * 0.08, y + (y1 - y) * 0.08)
    }
}

/** Add a wobbly ellipse to the current path. */
export function roughEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, seed: number, rough = 1) {
    const n = Math.max(12, Math.round((rx + ry) / 3))
    const start = jitter(seed, 99) * 0.6
    const pts: Pt[] = []
    for (let i = 0; i <= n + 1; i++) {
        const a = start + (i / n) * Math.PI * 2
        const r = 1 + jitter(seed, i) * (rough / Math.max(rx, ry, 1)) * 0.9
        pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r])
    }
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
}

/** Fill a polygon with pencil hatching (clipped), instead of a flat fill. */
export function hatch(ctx: CanvasRenderingContext2D, pts: Pt[], gap: number, angle: number, seed: number, rough = 0.8) {
    if (pts.length < 3) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const [x, y] of pts) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
    }
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.closePath()
    ctx.clip()

    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const diag = Math.hypot(maxX - minX, maxY - minY) / 2 + gap
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    ctx.beginPath()
    let i = 0
    for (let d = -diag; d <= diag; d += gap, i++) {
        // Line perpendicular to (cos, sin), offset by d.
        const px = cx + cos * d
        const py = cy + sin * d
        const x0 = px - sin * diag
        const y0 = py + cos * diag
        const x1 = px + sin * diag
        const y1 = py - cos * diag
        const j = jitter(seed, i) * rough
        ctx.moveTo(x0 + j, y0)
        ctx.lineTo(x1 - j, y1)
    }
    ctx.stroke()
    ctx.restore()
}

/** A scribbled-in blob: the pen goes back and forth inside a circle. */
export function scribble(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number, rows = 6) {
    ctx.beginPath()
    for (let i = 0; i <= rows; i++) {
        const t = -1 + (2 * i) / rows
        const y = cy + t * r * 0.85
        const half = Math.sqrt(Math.max(0, 1 - t * t)) * r
        const j = jitter(seed, i) * r * 0.15
        const xa = cx - half + j
        const xb = cx + half - j
        if (i === 0) ctx.moveTo(xa, y)
        if (i % 2 === 0) {
            ctx.lineTo(xa, y)
            ctx.lineTo(xb, y + jitter(seed, i + 50) * 2)
        } else {
            ctx.lineTo(xb, y)
            ctx.lineTo(xa, y + jitter(seed, i + 50) * 2)
        }
    }
    ctx.stroke()
}

/** Comic-book burst outline ("POW!"). */
export function burstPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, rOuter: number, rInner: number, n: number, seed: number) {
    const pts: Pt[] = []
    for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2 + jitter(seed, i) * 0.08
        const r = (i % 2 === 0 ? rOuter : rInner) * (1 + jitter(seed, i + 100) * 0.12)
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
    }
    ctx.beginPath()
    roughPoly(ctx, pts, seed, 0.8, true)
    ctx.closePath()
}

/** Five-point star outline. */
export function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number, rot = -Math.PI / 2) {
    const pts: Pt[] = []
    for (let i = 0; i < 10; i++) {
        const a = rot + (i / 10) * Math.PI * 2
        const rr = i % 2 === 0 ? r : r * 0.45
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
    }
    ctx.beginPath()
    roughPoly(ctx, pts, seed, r * 0.06, true)
    ctx.closePath()
}

/** Little "puff" cloud made of overlapping bumps. */
export function cloudPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, seed: number) {
    const bumps = 7
    ctx.beginPath()
    for (let i = 0; i < bumps; i++) {
        const a = (i / bumps) * Math.PI * 2
        const bx = cx + Math.cos(a) * w * 0.45
        const by = cy + Math.sin(a) * h * 0.45
        const r = (w + h) * 0.14 * (1 + jitter(seed, i) * 0.2)
        ctx.moveTo(bx + r, by)
        ctx.arc(bx, by, r, 0, Math.PI * 2)
    }
}

/** Stroke a quick handwritten arrow from (x0,y0) to (x1,y1). */
export function roughArrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, seed: number, head = 8) {
    const a = Math.atan2(y1 - y0, x1 - x0)
    ctx.beginPath()
    roughLine(ctx, x0, y0, x1, y1, seed, 1, 1)
    roughLine(ctx, x1, y1, x1 - Math.cos(a - 0.5) * head, y1 - Math.sin(a - 0.5) * head, seed + 1, 0.6, 1)
    roughLine(ctx, x1, y1, x1 - Math.cos(a + 0.5) * head, y1 - Math.sin(a + 0.5) * head, seed + 2, 0.6, 1)
    ctx.stroke()
}

/** Pen and pencil palettes used everywhere on the page. */
export const INK = {
    pen: "#1e2a5a",
    black: "#2b2b2b",
    pencil: "#7a7a7a",
    pencilLight: "#b9b9b9",
    red: "#d8312f",
    highlighter: "#ffe96b",
    paper: "#f6f1e4",
}

export function withAlpha(hex: string, alpha: number): string {
    const n = parseInt(hex.slice(1), 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** Handwritten quarters: 0.75 → "¾", -1.25 → "−1¼". */
export function fraction(v: number): string {
    const sign = v < 0 ? "−" : v > 0 ? "+" : ""
    const a = Math.abs(v)
    const quarters = a * 4
    if (Math.abs(quarters - Math.round(quarters)) > 1e-6) return `${sign}${Math.round(a * 100) / 100}`
    const whole = Math.floor(Math.round(quarters) / 4)
    const glyph = ["", "¼", "½", "¾"][Math.round(quarters) % 4]
    return `${sign}${whole || !glyph ? whole : ""}${glyph}`
}

/** SVG points of a slightly wobbly five-pointed star in a 24×24 box: the action-point ★ on cards and in the HUD. */
export function starPoints(seed: number): string {
    const pts: string[] = []
    for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2
        const r = (i % 2 === 0 ? 10 : 4.6) * (1 + jitter(seed, i) * 0.08)
        pts.push(`${(12 + Math.cos(a) * r).toFixed(1)},${(12 + Math.sin(a) * r).toFixed(1)}`)
    }
    return pts.join(" ")
}

/** SVG path of a slightly wobbly heart in a 24×22 box: health in the HUD and on the reward card. */
export function heartPath(seed: number): string {
    const j = (i: number, a = 0.9) => (jitter(seed, i) * a).toFixed(1)
    return `M12 ${20 + +j(1)} C ${2 + +j(2)} ${13 + +j(3)}, ${0 + +j(4)} ${7 + +j(5)}, ${3 + +j(6)} 4 C ${6 + +j(7)} ${1 + +j(8)}, ${10 + +j(9)} 2, 12 6 C ${14 + +j(10)} 2, ${18 + +j(11)} ${1 + +j(12)}, ${21 + +j(13)} 4 C ${24 + +j(14)} ${7 + +j(15)}, ${22 + +j(16)} ${13 + +j(17)}, 12 ${20 + +j(18)} Z`
}

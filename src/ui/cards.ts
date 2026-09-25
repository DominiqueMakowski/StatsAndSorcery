// Cards are index cards taped to the desk: a name in marker, a little pen sketch of what
// the action does to a line, and a scribbled description.

import { attackLine, FIELD } from "../core/shot"
import { heightAt, Z95 } from "../core/stats"
import type { Direction, Action } from "../core/types"
import { fraction, jitter, starPoints } from "../render/sketch"

export interface CardOptions {
    order?: number
    affordable: boolean
    /** Which directions are currently allowed (directional spells only). */
    dirs?: { up: boolean; down: boolean }
    onPlay?: (dir?: Direction) => void
    onHover?: (dir: Direction | undefined | null) => void
}

// Mini graph geometry: x ∈ [0, 1] → [12, 112], y ∈ [−1.2, 1.2] → [58, 2], in sketch units where a
// lane is ¼. Field values (spreads, shifts, steps) are converted with K.
const gx = (x: number) => 12 + x * 100
const gy = (y: number) => 30 - y * 23
const K = 0.25 / FIELD.laneStep

let clipCounter = 0

/** A wobbly SVG polyline through graph points. */
function roughPts(points: [number, number][], seed: number, rough = 0.8): string {
    return points.map(([x, y], i) => `${(gx(x) + jitter(seed, i * 2) * rough).toFixed(1)},${(gy(y) + jitter(seed, i * 2 + 1) * rough).toFixed(1)}`).join(" ")
}

function penLine(points: [number, number][], seed: number, width = 1.8, extra = "") {
    return `<polyline points="${roughPts(points, seed)}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`
}

/** A band filled with pencil hatching (clipped to the polygon). */
function band(mean: (x: number) => number, half: (x: number) => number, seed: number, faint = false) {
    const xs = Array.from({ length: 16 }, (_, i) => i / 15)
    const upper = xs.map((x) => [x, mean(x) + half(x)] as [number, number])
    const lower = xs.map((x) => [x, mean(x) - half(x)] as [number, number]).reverse()
    const poly = roughPts([...upper, ...lower], seed, 0.5)
    const id = `clip${clipCounter++}`
    let lines = ""
    for (let d = -80; d < 160; d += 6) lines += `<line x1="${d}" y1="0" x2="${d + 60}" y2="60"/>`
    const opacity = faint ? 0.25 : 0.55
    return `<clipPath id="${id}"><polygon points="${poly}"/></clipPath>
        <polygon points="${poly}" fill="currentColor" fill-opacity="${faint ? 0.04 : 0.08}"/>
        <g clip-path="url(#${id})" stroke="currentColor" stroke-opacity="${opacity}" stroke-width="0.9">${lines}</g>
        ${penLine(upper, seed + 1, 1, `stroke-dasharray="3 3" stroke-opacity="${faint ? 0.4 : 0.8}"`)}
        ${penLine(lower.slice().reverse(), seed + 2, 1, `stroke-dasharray="3 3" stroke-opacity="${faint ? 0.4 : 0.8}"`)}`
}

const axes = (seed: number) => `<g style="color:#7a7a7a">
    ${penLine(
        [
            [0, 1.15],
            [0, -1.15],
        ],
        seed + 50,
        1.2
    )}
    ${penLine(
        [
            [0, 0],
            [1, 0],
        ],
        seed + 51,
        1,
        'stroke-dasharray="2 3" stroke-opacity="0.6"'
    )}
</g>`

const arrow = (x: number, y1: number, y2: number, seed: number) => {
    const s = y2 > y1 ? 1 : -1
    return penLine(
        [
            [x, y1],
            [x, y2],
        ],
        seed,
        1.6
    ) + penLine(
        [
            [x - 0.04, y2 - s * 0.16],
            [x, y2],
            [x + 0.04, y2 - s * 0.16],
        ],
        seed + 1,
        1.6
    )
}

const target = (x: number, y: number, seed: number) =>
    penLine(
        [
            [x - 0.03, y - 0.12],
            [x + 0.03, y + 0.12],
        ],
        seed,
        1.8
    ) +
    penLine(
        [
            [x + 0.03, y - 0.12],
            [x - 0.03, y + 0.12],
        ],
        seed + 1,
        1.8
    )

/** A tiny pen sketch of what the action does to a line. */
export function actionGraph(action: Action): string {
    const seed = hashId(action.id)
    let body = ""
    switch (action.kind) {
        case "spell": {
            const line = attackLine(action)
            body = band(
                (x) => K * heightAt(line, x).mean,
                (x) => K * Z95 * heightAt(line, x).sd,
                seed
            )
            body += penLine(
                [
                    [0, 0],
                    [1, 0],
                ],
                seed + 3,
                2
            )
            body += target(1, 0, seed + 4)
            break
        }
        case "alteration":
            if (action.dBeta0 && action.dBeta1) {
                // Arc: up, then down, over a wall.
                body = `<rect x="${gx(0.5) - 3}" y="${gy(0.32)}" width="6" height="${gy(-0.32) - gy(0.32)}" rx="1.5" fill="#7a7a7a" fill-opacity="0.5"/>`
                body += penLine(
                    [
                        [0, 0],
                        [1, 0],
                    ],
                    seed + 5,
                    1.2,
                    'stroke-opacity="0.35" stroke-dasharray="3 3"'
                )
                body += penLine(
                    [
                        [0, 0.55],
                        [1, 0],
                    ],
                    seed + 6,
                    2
                )
                body += target(1, 0, seed + 7)
            } else if (action.dBeta0) {
                const d = K * action.dBeta0 * 1.4
                body = penLine(
                    [
                        [0, -0.3],
                        [1, -0.3],
                    ],
                    seed + 5,
                    1.2,
                    'stroke-opacity="0.35" stroke-dasharray="3 3"'
                )
                body += penLine(
                    [
                        [0, -0.3 + d],
                        [1, -0.3 + d],
                    ],
                    seed + 6,
                    2
                )
                body += arrow(0.12, -0.25, -0.3 + d - 0.06, seed + 7)
            } else if (action.dBeta1) {
                body = penLine(
                    [
                        [0, -0.3],
                        [1, -0.3],
                    ],
                    seed + 5,
                    1.2,
                    'stroke-opacity="0.35" stroke-dasharray="3 3"'
                )
                body += penLine(
                    [
                        [0, -0.3],
                        [1, 0.75],
                    ],
                    seed + 6,
                    2
                )
                body += `<path d="M${gx(0.55)} ${gy(-0.3)} A 26 26 0 0 0 ${gx(0.5)} ${gy(0.22)}" stroke="currentColor" fill="none" stroke-width="1.3" stroke-linecap="round"/>`
            } else {
                body = band(
                    () => 0,
                    (x) => 0.25 + 0.6 * x,
                    seed,
                    true
                )
                body += band(
                    () => 0,
                    (x) => 0.12 + 0.3 * x,
                    seed + 10
                )
                body += penLine(
                    [
                        [0, 0],
                        [1, 0],
                    ],
                    seed + 3,
                    1.6
                )
            }
            break
        case "movement": {
            const to = K * action.step >= 1 ? 0.9 : 0.5
            body = `<circle cx="${gx(0.25)}" cy="${gy(-0.45)}" r="4.5" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-dasharray="2 2"/>`
            body += `<circle cx="${gx(0.25)}" cy="${gy(to)}" r="5" fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="1.6"/>`
            body += arrow(0.25, -0.3, to - 0.24, seed + 8)
            body += penLine(
                [
                    [0.5, 0],
                    [0.58, 0.1],
                    [0.66, -0.1],
                    [0.74, 0.1],
                    [0.82, -0.1],
                    [0.9, 0],
                ],
                seed + 9,
                1,
                'stroke-opacity="0.5"'
            )
            break
        }
        case "ward":
            body = penLine(
                [
                    [0, 0],
                    [0.46, 0],
                ],
                seed + 5,
                1.8,
                'style="color:#7a7a7a"'
            )
            body += `<rect x="${gx(0.5) - 4}" y="${gy(0.5)}" width="8" height="${gy(-0.5) - gy(0.5)}" rx="2" fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="1.6"/>`
            for (let i = 1; i < 4; i++) body += `<line x1="${gx(0.5) - 4}" y1="${gy(0.5 - i * 0.25)}" x2="${gx(0.5) + 4}" y2="${gy(0.5 - i * 0.25)}" stroke="currentColor" stroke-width="1"/>`
            body += `<text x="${gx(0.47)}" y="${gy(0.1)}" font-size="9" fill="currentColor" font-family="Caveat, cursive" font-weight="700">clank</text>`
            break
        case "hex":
            body = band(
                () => 0,
                (x) => 0.1 + 0.15 * x,
                seed,
                true
            )
            body += band(
                () => 0,
                (x) => 0.25 + 0.7 * x,
                seed + 10
            )
            break
    }
    return `<svg class="card-graph" viewBox="0 0 120 60" aria-hidden="true">${axes(seed)}${body}</svg>`
}

function hashId(id: string): number {
    let h = 7
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0
    return h
}

function statsLine(action: Action): string {
    if (action.kind !== "spell") return ""
    const h = heightAt(attackLine(action), 1)
    return `<div class="card-stats"><span>95% band <b>±${(Z95 * h.sd).toFixed(1)}</b></span><span>dmg <b>${action.damage}</b></span></div>`
}

export function createCard(action: Action, opts: CardOptions): HTMLElement {
    const el = document.createElement("div")
    el.className = "card"
    el.style.setProperty("--el", `var(--${action.element})`)
    el.style.setProperty("--tilt", `${(jitter(hashId(action.id) + (opts.order ?? 0), 3) * 2.2).toFixed(2)}deg`)
    if (action.name.length > 10) el.classList.add("has-long-name")
    if (opts.order) el.classList.add("is-queued")
    if (!opts.affordable && !opts.order) el.classList.add("is-unaffordable")
    el.setAttribute("role", "button")
    el.setAttribute("aria-label", `${action.name} (${action.kind}), ${action.cost} action point${action.cost === 1 ? "" : "s"}. ${action.description}`)

    el.innerHTML = `
        <span class="card-tape">${action.kind}</span>
        <div class="card-cost" title="Action points"><svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="${starPoints(hashId(action.id))}"/></svg><span>${action.cost}</span></div>
        ${opts.order ? `<div class="card-order">${opts.order}</div>` : ""}
        <div class="card-head">
            <span class="card-name">${action.name}</span>
            ${action.symbol ? `<span class="card-symbol">${action.symbol}</span>` : ""}
        </div>
        ${actionGraph(action)}
        <div class="card-desc">${action.description}</div>
        ${statsLine(action)}
    `

    if (opts.dirs && !opts.order) {
        // An alteration of one parameter labels its buttons with the change itself (+½, −½).
        const step = action.kind === "alteration" && (action.dBeta0 === undefined) !== (action.dBeta1 === undefined) ? (action.dBeta0 ?? action.dBeta1)! : null
        const dirs = document.createElement("div")
        dirs.className = "card-dirs"
        for (const [dir, label, allowed] of [
            [1, "▲", opts.dirs.up],
            [-1, "▼", opts.dirs.down],
        ] as const) {
            const b = document.createElement("button")
            b.className = "card-dir"
            b.innerHTML = `<span>${label}</span><small>${step !== null ? fraction(dir * step) : dir > 0 ? "up" : "down"}</small>`
            b.disabled = !allowed || !opts.affordable
            b.onclick = (e) => {
                e.stopPropagation()
                opts.onPlay?.(dir)
            }
            b.onmouseenter = () => opts.onHover?.(dir)
            b.onmouseleave = () => opts.onHover?.(null)
            dirs.appendChild(b)
        }
        el.appendChild(dirs)
    } else {
        el.onclick = () => opts.onPlay?.()
        el.onmouseenter = () => opts.onHover?.(undefined)
        el.onmouseleave = () => opts.onHover?.(null)
    }
    return el
}

export function createCardBack(): HTMLElement {
    const el = document.createElement("div")
    el.className = "card-back"
    el.innerHTML = `<span class="card-tape"></span><span>?</span>`
    return el
}

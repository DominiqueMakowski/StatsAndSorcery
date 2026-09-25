// The score strip: names in marker, hearts for health, stars for action points.

import type { Duel } from "../core/duel"
import type { Side } from "../core/types"
import { jitter, starPoints } from "../render/sketch"

function heartPath(seed: number): string {
    // A slightly wobbly heart in a 24×22 box.
    const j = (i: number, a = 0.9) => (jitter(seed, i) * a).toFixed(1)
    return `M12 ${20 + +j(1)} C ${2 + +j(2)} ${13 + +j(3)}, ${0 + +j(4)} ${7 + +j(5)}, ${3 + +j(6)} 4 C ${6 + +j(7)} ${1 + +j(8)}, ${10 + +j(9)} 2, 12 6 C ${14 + +j(10)} 2, ${18 + +j(11)} ${1 + +j(12)}, ${21 + +j(13)} 4 C ${24 + +j(14)} ${7 + +j(15)}, ${22 + +j(16)} ${13 + +j(17)}, 12 ${20 + +j(18)} Z`
}

const scribbleCross = `<path class="scribble" d="M4 4 L20 19 M20 3 L5 20 M6 10 L18 14" stroke-width="2.2" stroke-linecap="round"/>`

export function renderPanel(el: HTMLElement, duel: Duel, side: Side, queuedCost: number, justLost = 0) {
    const w = duel.wizards[side]
    const active = duel.turn === side && !duel.winner
    el.classList.toggle("is-active", active)

    const hp = Array.from({ length: w.maxHp }, (_, i) => {
        const lost = i >= w.hp
        const hit = lost && i < w.hp + justLost
        return `<svg class="hp-heart${lost ? " is-lost" : ""}${hit ? " is-hit" : ""}" viewBox="0 0 24 24" aria-hidden="true">
            <path d="${heartPath(side === "left" ? i : i + 50)}"/>${lost ? scribbleCross : ""}</svg>`
    }).join("")

    const apTotal = w.character.ap
    const apNow = active ? w.ap : apTotal
    const ap = Array.from({ length: apTotal }, (_, i) => {
        let cls = ""
        if (i >= apNow) cls = " is-spent"
        else if (active && i >= apNow - queuedCost) cls = " is-queued"
        return `<svg class="ap-star${cls}" viewBox="0 0 24 24" aria-hidden="true"><polygon points="${starPoints(i + 7)}"/></svg>`
    }).join("")

    const jinxed = (active ? w.turnSdScale : w.pendingHex) > 1
    el.innerHTML = `
        <div class="wizard-name">${w.character.name}<span class="wizard-title">${w.character.title}</span></div>
        <div class="pips" aria-label="${w.hp} of ${w.maxHp} health">${hp}</div>
        <div class="pips" aria-label="${apNow} action points">${ap}${jinxed ? `<span class="status-chip">jinxed σ×2</span>` : ""}</div>
    `
}

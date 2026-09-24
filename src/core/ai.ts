// Opponent brain: try every legal sequence of cards, score it, then pick one.
// With 3 cards and 2 AP there are only a few dozen candidates, so brute force is fine.

import { getSpell } from "../content/spells"
import { other, previewPlan, type Duel } from "./duel"
import type { Rng } from "./rng"
import { isDirectional, type AttackSpell, type Direction, type Play, type Side } from "./types"

export interface ScoredPlan {
    plays: Play[]
    score: number
}

export function candidatePlans(duel: Duel, side: Side): Play[][] {
    const w = duel.wizards[side]
    const plans: Play[][] = [[]]

    const extend = (plan: Play[], apLeft: number) => {
        for (const card of w.hand) {
            if (plan.some((p) => p.uid === card.uid)) continue
            const spell = getSpell(card.spellId)
            if (spell.cost > apLeft) continue
            const dirs: (Direction | undefined)[] = isDirectional(spell) ? [1, -1] : [undefined]
            for (const dir of dirs) {
                const next = [...plan, dir ? { uid: card.uid, dir } : { uid: card.uid }]
                if (!previewPlan(duel, side, next)) continue
                plans.push(next)
                extend(next, apLeft - spell.cost)
            }
        }
    }
    extend([], w.ap)
    return plans
}

export function scorePlan(duel: Duel, side: Side, plays: Play[]): number {
    const preview = previewPlan(duel, side, plays)
    if (!preview) return -Infinity
    const me = duel.wizards[side]
    const opponent = duel.wizards[other(side)]

    let score = 0
    for (const attack of preview.attacks) score += attack.hitChance * (getSpell(attack.spellId) as AttackSpell).damage

    for (const play of plays) {
        const spell = getSpell(me.hand.find((c) => c.uid === play.uid)!.spellId)
        if (spell.kind === "ward" && !duel.wards.some((w) => w.owner === side)) score += 0.35
        if (spell.kind === "hex" && opponent.pendingHex === 1) score += 0.3
    }

    // Standing in the opponent's lane makes you an easy target.
    if (preview.finalY === opponent.y) score -= 0.15
    // A modifier with no attack after it is a wasted card, even for a sloppy wizard.
    if (preview.danglingMods) score -= 0.4
    score -= 0.02 * preview.apLeft
    return score
}

/**
 * Choose a plan. `sloppiness` (0–1) sets the softmax temperature: 0 plays the best
 * plan almost always, 1 plays something reasonable but often suboptimal.
 */
export function planTurn(duel: Duel, side: Side, sloppiness: number, rng: Rng): Play[] {
    const scored: ScoredPlan[] = candidatePlans(duel, side).map((plays) => ({ plays, score: scorePlan(duel, side, plays) }))
    const temperature = 0.02 + sloppiness * 0.5
    const best = Math.max(...scored.map((s) => s.score))
    const weights = scored.map((s) => Math.exp((s.score - best) / temperature))
    const total = weights.reduce((a, b) => a + b, 0)
    let r = rng.next() * total
    for (let i = 0; i < scored.length; i++) {
        r -= weights[i]
        if (r <= 0) return scored[i].plays
    }
    return scored[scored.length - 1].plays
}

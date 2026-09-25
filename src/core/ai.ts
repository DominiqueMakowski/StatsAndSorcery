// Opponent brain: try every legal sequence of cards, score it, then pick one.
// With 3 cards and 2 AP there are only a few dozen candidates, so brute force is fine.

import { getAction } from "../content/actions"
import { other, previewPlan, type Duel } from "./duel"
import type { Rng } from "./rng"
import { attackLine, clampY, hitChance, NO_MODS } from "./shot"
import { isDirectional, type Direction, type MovementAction, type Play, type Side, type SpellAction } from "./types"

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
            const action = getAction(card.actionId)
            if (action.cost > apLeft) continue
            const dirs: (Direction | undefined)[] = isDirectional(action) ? [1, -1] : [undefined]
            for (const dir of dirs) {
                const next = [...plan, dir ? { uid: card.uid, dir } : { uid: card.uid }]
                if (!previewPlan(duel, side, next)) continue
                plans.push(next)
                extend(next, apLeft - action.cost)
            }
        }
    }
    extend([], w.ap)
    return plans
}

/**
 * Expected damage the opponent could deal next turn to `side` standing at `y`: the best of moving
 * toward that spot and then firing their best spell, with the spread they'll have (hexes included).
 */
export function threatAt(duel: Duel, side: Side, y: number): number {
    const foe = duel.wizards[other(side)]
    const known = [...new Set(foe.character.deck)].map(getAction)
    const spells = known.filter((a): a is SpellAction => a.kind === "spell")
    const moves = known.filter((a): a is MovementAction => a.kind === "movement")
    const ap = foe.character.ap
    let best = 0
    const fireFrom = (fromY: number, apLeft: number) => {
        for (const spell of spells) {
            const shots = Math.floor(apLeft / spell.cost)
            if (shots === 0) continue
            const p = hitChance(attackLine(spell, NO_MODS, foe.pendingHex), foe.side, fromY, y, duel.wards)
            best = Math.max(best, shots * p * spell.damage)
        }
    }
    fireFrom(foe.y, ap)
    for (const move of moves) {
        let fromY = foe.y
        for (let k = 1; k * move.cost <= ap; k++) {
            fromY = clampY(fromY + Math.sign(y - fromY) * move.step)
            fireFrom(fromY, ap - k * move.cost)
        }
    }
    return best
}

export function scorePlan(duel: Duel, side: Side, plays: Play[], threat = (y: number) => threatAt(duel, side, y)): number {
    const preview = previewPlan(duel, side, plays)
    if (!preview) return -Infinity
    const me = duel.wizards[side]
    const opponent = duel.wizards[other(side)]

    let score = 0
    for (const attack of preview.attacks) {
        score += attack.hitChance * (getAction(attack.actionId) as SpellAction).damage
        // Don't fire hopeless shots just to spend points: it looks silly and teaches nothing.
        if (attack.hitChance < 0.05) score -= 0.05
    }

    for (const play of plays) {
        const action = getAction(me.hand.find((c) => c.uid === play.uid)!.actionId)
        if (action.kind === "ward" && !duel.wards.some((w) => w.owner === side)) score += 0.35
        if (action.kind === "hex" && opponent.pendingHex === 1) score += 0.3
    }

    // Where you end your turn is where they'll shoot: a cautious wizard hits and runs. Caution halves
    // every few quiet turns, so two careful wizards can't circle each other forever.
    const caution = (me.character.caution ?? 0) * 0.5 ** (duel.quietTurns / 3)
    score -= caution * threat(preview.finalY)
    // An alteration with no attack after it is a wasted card, even for a sloppy wizard.
    if (preview.danglingMods) score -= 0.4
    score -= 0.02 * preview.apLeft
    return score
}

/**
 * Choose a plan. `sloppiness` (0–1) sets the softmax temperature: 0 plays the best
 * plan almost always, 1 plays something reasonable but often suboptimal.
 */
export function planTurn(duel: Duel, side: Side, sloppiness: number, rng: Rng): Play[] {
    // Many plans end on the same spot, and the threat there can need Monte Carlo (wards), so cache it.
    const threats = new Map<number, number>()
    const threat = (y: number) => {
        if (!threats.has(y)) threats.set(y, threatAt(duel, side, y))
        return threats.get(y)!
    }
    const scored: ScoredPlan[] = candidatePlans(duel, side).map((plays) => ({ plays, score: scorePlan(duel, side, plays, threat) }))
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

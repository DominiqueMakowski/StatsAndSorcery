import { describe, expect, test } from "bun:test"
import { Characters, type Character } from "../content/characters"
import { RUN_STAGES } from "../content/run"
import { getAction } from "../content/actions"
import { planTurn, threatAt } from "./ai"
import { Duel, previewPlan } from "./duel"
import { createRng } from "./rng"
import { attackLine, FIELD, hitChance, LANES } from "./shot"
import type { SpellAction } from "./types"

const withDeck = (base: Character, deck: string[], extra: Partial<Character> = {}): Character => ({ ...base, deck, ...extra })
/** Hit chance of a plain Flame at a target in the caster's own lane. */
const alignedFlame = hitChance(attackLine(getAction("flame") as SpellAction), "left", 0, 0, [])

describe("duel rules", () => {
    test("every hand contains a spell", () => {
        const deck = ["intercept", "intercept", "slope", "halve_sd", "move", "move", "flame"]
        for (let seed = 0; seed < 50; seed++) {
            const duel = new Duel({ left: withDeck(Characters.apprentice, deck), right: Characters.plotter, seed })
            duel.start()
            expect(duel.active.hand.some((c) => getAction(c.actionId).kind === "spell")).toBe(true)
        }
    })

    test("playing cards spends AP and rejects illegal plays", () => {
        const duel = new Duel({ left: withDeck(Characters.apprentice, ["frost_ray", "intercept", "move"]), right: Characters.plotter, seed: 1 })
        duel.start()
        const byId = (id: string) => duel.active.hand.find((c) => c.actionId === id)!
        expect(duel.whyNot({ uid: byId("intercept").uid })).toBe("Choose a direction")
        duel.play({ uid: byId("intercept").uid, dir: 1 })
        expect(duel.active.ap).toBe(1)
        expect(duel.whyNot({ uid: byId("frost_ray").uid })).toBe("Not enough action points")
    })

    test("a precise shot at an aligned target deals damage and can end the duel", () => {
        const sniper = withDeck(Characters.apprentice, ["frost_ray", "frost_ray", "frost_ray"], { ap: 6 })
        const duel = new Duel({ left: sniper, right: withDeck(Characters.plotter, ["flame"], { hp: 2, startY: 0 }), seed: 4 })
        duel.start()
        const events = duel.active.hand.slice(0, 2).flatMap((c) => duel.play({ uid: c.uid }))
        expect(events.filter((e) => e.type === "damage")).toHaveLength(2)
        expect(duel.winner).toBe("left")
        expect(events.at(-1)).toEqual({ type: "gameOver", winner: "left" })
    })

    test("preview applies queued alterations and movement to the spell", () => {
        const duel = new Duel({ left: withDeck(Characters.apprentice, ["flame", "intercept", "move"], { ap: 3 }), right: Characters.plotter, seed: 2 })
        duel.start()
        const card = (id: string) => duel.active.hand.find((c) => c.actionId === id)!.uid

        // One lane off: a straight Flame is a gamble, and a Move lines it up.
        duel.wizards.right.y = FIELD.laneStep
        const flat = previewPlan(duel, "left", [{ uid: card("flame") }])!
        const moved = previewPlan(duel, "left", [{ uid: card("move"), dir: 1 }, { uid: card("flame") }])!
        expect(flat.attacks[0].hitChance).toBeGreaterThan(0.1)
        expect(flat.attacks[0].hitChance).toBeLessThan(0.5)
        expect(moved.attacks[0].casterY).toBe(FIELD.laneStep)
        expect(moved.attacks[0].hitChance).toBeCloseTo(alignedFlame, 6)

        // Two lanes off: a straight Flame misses, and Intercept +½ (β₀) lifts the line onto them.
        duel.wizards.right.y = 2 * FIELD.laneStep
        const shifted = previewPlan(duel, "left", [{ uid: card("intercept"), dir: 1 }, { uid: card("flame") }])!
        expect(previewPlan(duel, "left", [{ uid: card("flame") }])!.attacks[0].hitChance).toBeLessThan(0.02)
        expect(shifted.attacks[0].hitChance).toBeCloseTo(alignedFlame, 6)

        // A Move after the spell doesn't re-aim it (hit and run), but it does move you.
        const run = previewPlan(duel, "left", [{ uid: card("flame") }, { uid: card("move"), dir: -1 }])!
        expect(run.attacks[0].casterY).toBe(0)
        expect(run.finalY).toBe(-FIELD.laneStep)
    })

    test("jinx doubles the opponent's spread on their next turn only", () => {
        const hexer = withDeck(Characters.voldemode, ["jinx"], { handSize: 1 })
        const duel = new Duel({ left: withDeck(Characters.apprentice, ["flame"], { handSize: 1 }), right: hexer, seed: 3 })
        duel.start()
        duel.endTurn()
        duel.play({ uid: duel.active.hand[0].uid })
        duel.endTurn()
        expect(duel.active.turnSdScale).toBe(2)
        duel.endTurn()
        duel.endTurn()
        expect(duel.active.turnSdScale).toBe(1)
    })
})

describe("AI", () => {
    test("a careful AI corrects its aim when the target is off-lane", () => {
        const aimer = withDeck(Characters.plotter, ["flame", "intercept", "move"], { sloppiness: 0, startY: 0 })
        const duel = new Duel({ left: Characters.apprentice, right: aimer, seed: 5 })
        duel.start()
        duel.endTurn()
        duel.wizards.left.y = 0.5
        const plan = planTurn(duel, "right", 0, createRng(1))
        const preview = previewPlan(duel, "right", plan)!
        expect(preview.attacks).toHaveLength(1)
        expect(preview.attacks[0].hitChance).toBeCloseTo(alignedFlame, 6)
    })

    test("threat: standing in their line is worst, one lane off they must spend a move to line up", () => {
        const duel = new Duel({ left: Characters.apprentice, right: withDeck(Characters.plotter, ["flame", "move"], { startY: 0 }), seed: 6 })
        duel.start()
        expect(threatAt(duel, "left", 0)).toBeCloseTo(2 * alignedFlame, 6)
        expect(threatAt(duel, "left", FIELD.laneStep)).toBeCloseTo(alignedFlame, 6)
        expect(threatAt(duel, "left", 3 * FIELD.laneStep)).toBeLessThan(0.05)
    })

    test("a cautious AI with one spell hits and runs", () => {
        const dodger = withDeck(Characters.plotter, ["flame", "move", "move"], { sloppiness: 0, startY: 0 })
        const duel = new Duel({ left: Characters.apprentice, right: dodger, seed: 8 })
        duel.start()
        duel.endTurn()
        duel.wizards.left.y = duel.wizards.right.y
        const plan = planTurn(duel, "right", 0, createRng(2))
        const preview = previewPlan(duel, "right", plan)!
        expect(getAction(duel.active.hand.find((c) => c.uid === plan[0].uid)!.actionId).id).toBe("flame")
        expect(preview.attacks[0].hitChance).toBeCloseTo(alignedFlame, 6)
        expect(preview.finalY).not.toBe(duel.wizards.left.y)
    })

    test("two cautious wizards still finish their duel (impatience)", () => {
        const careful = (c: Character) => ({ ...c, caution: 1 })
        const rng = createRng(4)
        for (let seed = 0; seed < 12; seed++) {
            const duel = new Duel({ left: careful(Characters.apprentice), right: careful(Characters.plotter), seed })
            duel.start()
            for (let t = 0; t < 200 && !duel.winner; t++) {
                for (const play of planTurn(duel, duel.turn, 0.2, rng)) if (!duel.winner) duel.play(play)
                if (!duel.winner) duel.endTurn()
            }
            expect(duel.winner).not.toBeNull()
        }
    })
})

describe("content", () => {
    test("every deck and reward names a real card, and rewards are never enemy-only", () => {
        for (const c of Object.values(Characters)) {
            for (const id of c.deck) expect(() => getAction(id)).not.toThrow()
            expect(LANES).toContain(c.startY ?? 0)
        }
        for (const stage of RUN_STAGES) {
            expect(Characters[stage.enemy]).toBeDefined()
            for (const id of stage.rewards) expect(getAction(id).enemyOnly).toBeFalsy()
        }
    })
})

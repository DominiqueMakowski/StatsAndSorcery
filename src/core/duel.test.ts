import { describe, expect, test } from "bun:test"
import { Characters, type Character } from "../content/characters"
import { getSpell } from "../content/spells"
import { planTurn } from "./ai"
import { Duel, previewPlan } from "./duel"
import { createRng } from "./rng"

const withDeck = (base: Character, deck: string[], extra: Partial<Character> = {}): Character => ({ ...base, deck, ...extra })

describe("duel rules", () => {
    test("every hand contains an attack", () => {
        const deck = ["shift", "shift", "tilt", "focus", "blink", "blink", "firebolt"]
        for (let seed = 0; seed < 50; seed++) {
            const duel = new Duel({ left: withDeck(Characters.apprentice, deck), right: Characters.wendel, seed })
            duel.start()
            expect(duel.active.hand.some((c) => getSpell(c.spellId).kind === "attack")).toBe(true)
        }
    })

    test("playing cards spends AP and rejects illegal plays", () => {
        const duel = new Duel({ left: withDeck(Characters.apprentice, ["frost_ray", "shift", "blink"]), right: Characters.wendel, seed: 1 })
        duel.start()
        const byId = (id: string) => duel.active.hand.find((c) => c.spellId === id)!
        expect(duel.whyNot({ uid: byId("shift").uid })).toBe("Choose a direction")
        duel.play({ uid: byId("shift").uid, dir: 1 })
        expect(duel.active.ap).toBe(1)
        expect(duel.whyNot({ uid: byId("frost_ray").uid })).toBe("Not enough action points")
    })

    test("a precise shot at an aligned target deals damage and can end the duel", () => {
        const sniper = withDeck(Characters.apprentice, ["frost_ray", "frost_ray", "frost_ray"], { ap: 6 })
        const duel = new Duel({ left: sniper, right: withDeck(Characters.wendel, ["firebolt"], { hp: 2 }), seed: 4 })
        duel.start()
        const events = duel.active.hand.slice(0, 2).flatMap((c) => duel.play({ uid: c.uid }))
        expect(events.filter((e) => e.type === "damage")).toHaveLength(2)
        expect(duel.winner).toBe("left")
        expect(events.at(-1)).toEqual({ type: "gameOver", winner: "left" })
    })

    test("preview applies queued modifiers and movement to the attack", () => {
        const duel = new Duel({ left: withDeck(Characters.apprentice, ["firebolt", "shift", "blink"], { ap: 3 }), right: Characters.wendel, seed: 2 })
        duel.start()
        duel.wizards.right.y = 0.5
        const card = (id: string) => duel.active.hand.find((c) => c.spellId === id)!.uid
        const flat = previewPlan(duel, "left", [{ uid: card("firebolt") }])!
        const shifted = previewPlan(duel, "left", [{ uid: card("shift"), dir: 1 }, { uid: card("firebolt") }])!
        const moved = previewPlan(duel, "left", [{ uid: card("blink"), dir: 1 }, { uid: card("firebolt") }])!
        expect(flat.attacks[0].hitChance).toBeLessThan(0.01)
        expect(shifted.attacks[0].hitChance).toBeGreaterThan(0.8)
        expect(moved.attacks[0].casterY).toBe(0.5)
        expect(moved.attacks[0].hitChance).toBeGreaterThan(0.8)
    })

    test("jinx doubles the opponent's spread on their next turn only", () => {
        const hexer = withDeck(Characters.outlier, ["jinx"], { handSize: 1 })
        const duel = new Duel({ left: withDeck(Characters.apprentice, ["firebolt"], { handSize: 1 }), right: hexer, seed: 3 })
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
        const aimer = withDeck(Characters.wendel, ["firebolt", "shift", "blink"], { sloppiness: 0 })
        const duel = new Duel({ left: Characters.apprentice, right: aimer, seed: 5 })
        duel.start()
        duel.endTurn()
        duel.wizards.left.y = 0.5
        const plan = planTurn(duel, "right", 0, createRng(1))
        const preview = previewPlan(duel, "right", plan)!
        expect(preview.attacks).toHaveLength(1)
        expect(preview.attacks[0].hitChance).toBeGreaterThan(0.8)
    })
})

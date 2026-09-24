import { describe, expect, test } from "bun:test"
import { createRng } from "./rng"
import { attackLine, hitChance, resolveShot } from "./shot"
import { ci95, heightAt, normalCdf, Z95 } from "./stats"
import { getSpell } from "../content/spells"
import type { AttackSpell, Ward } from "./types"

describe("normal distribution", () => {
    test("CDF matches known values", () => {
        expect(normalCdf(0)).toBeCloseTo(0.5, 6)
        expect(normalCdf(1)).toBeCloseTo(0.841345, 5)
        expect(normalCdf(-1.959964)).toBeCloseTo(0.025, 5)
    })

    test("sampler has the right mean and sd", () => {
        const rng = createRng(1)
        const xs = Array.from({ length: 50_000 }, () => rng.normal())
        const mean = xs.reduce((a, b) => a + b, 0) / xs.length
        const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length)
        expect(mean).toBeCloseTo(0, 1)
        expect(sd).toBeCloseTo(1, 1)
    })
})

describe("spell uncertainty", () => {
    const firebolt = getSpell("firebolt") as AttackSpell
    const lightning = getSpell("chain_lightning") as AttackSpell

    test("about 95% of shots land inside the 95% band", () => {
        const rng = createRng(2)
        const line = attackLine(lightning)
        const [lo, hi] = ci95(heightAt(line, 1))
        let inside = 0
        const n = 40_000
        for (let i = 0; i < n; i++) {
            const shot = resolveShot(line, "left", 0, 0, [], rng)
            const y = shot.sample.beta0 + shot.sample.beta1
            if (y >= lo && y <= hi) inside++
        }
        expect(inside / n).toBeGreaterThan(0.94)
        expect(inside / n).toBeLessThan(0.96)
    })

    test("band half-width grows with distance", () => {
        const line = attackLine(firebolt)
        expect(heightAt(line, 0).sd * Z95).toBeCloseTo(firebolt.beta0.sd * Z95, 6)
        expect(heightAt(line, 1).sd).toBeGreaterThan(heightAt(line, 0.5).sd)
    })

    test("exact hit chance agrees with simulation", () => {
        const rng = createRng(3)
        for (const [targetY, mods] of [
            [0, { dBeta0: 0, dBeta1: 0, sdScale: 1 }],
            [0.5, { dBeta0: 0.5, dBeta1: 0, sdScale: 1 }],
            [0.5, { dBeta0: 0, dBeta1: 0, sdScale: 1 }],
        ] as const) {
            const line = attackLine(lightning, mods)
            const exact = hitChance(line, "left", 0, targetY, [])
            let hits = 0
            const n = 40_000
            for (let i = 0; i < n; i++) if (resolveShot(line, "left", 0, targetY, [], rng).outcome === "hit") hits++
            expect(Math.abs(hits / n - exact)).toBeLessThan(0.01)
        }
    })

    test("wards make slope and intercept different", () => {
        // Enemy one lane up; the ward sits on the straight line between the wizards.
        const ward: Ward = { id: 1, owner: "right", x: 0.5, y: 0.25, halfHeight: 0.15 }
        const shifted = attackLine(firebolt, { dBeta0: 0.5, dBeta1: 0, sdScale: 1 })
        const tilted = attackLine(firebolt, { dBeta0: 0, dBeta1: 0.5, sdScale: 1 })
        // Without the ward both corrections reach the target equally well...
        expect(hitChance(tilted, "left", 0, 0.5, [])).toBeCloseTo(hitChance(shifted, "left", 0, 0.5, []), 1)
        // ...with it, tilting runs straight into the ward while shifting passes over it.
        expect(hitChance(tilted, "left", 0, 0.5, [ward])).toBeLessThan(0.05)
        expect(hitChance(shifted, "left", 0, 0.5, [ward])).toBeGreaterThan(0.8)

        // Aligned wizards: only an arc (up, then back down) gets around the ward.
        const lowWard: Ward = { ...ward, y: 0 }
        expect(hitChance(attackLine(firebolt), "left", 0, 0, [lowWard])).toBeLessThan(0.05)
        const arc = attackLine(firebolt, { dBeta0: 0.5, dBeta1: -0.5, sdScale: 1 })
        expect(hitChance(arc, "left", 0, 0, [lowWard])).toBeGreaterThan(0.8)
    })

    test("right-side wizards shoot in their own mirrored frame", () => {
        const line = attackLine(firebolt, { dBeta0: 0, dBeta1: -0.5, sdScale: 1 })
        expect(hitChance(line, "right", 0.5, 0, [])).toBeGreaterThan(0.8)
    })
})

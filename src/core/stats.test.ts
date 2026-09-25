import { describe, expect, test } from "bun:test"
import { createRng } from "./rng"
import { attackLine, bouncePoints, FIELD, hitChance, reflect, resolveShot } from "./shot"
import { ci95, heightAt, normalCdf, Z95 } from "./stats"
import { getAction } from "../content/actions"
import type { SpellAction, Ward } from "./types"

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

// Field values below are in lanes, so the tests don't care what a lane measures.
const L = FIELD.laneStep

describe("spell uncertainty", () => {
    const flame = getAction("flame") as SpellAction
    const lightning = getAction("chain_lightning") as SpellAction
    // Geometry tests use the most precise spell, so spread doesn't blur the answer.
    const frost = getAction("frost_ray") as SpellAction

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
        const line = attackLine(flame)
        expect(heightAt(line, 0).sd * Z95).toBeCloseTo(flame.beta0.sd * Z95, 6)
        expect(heightAt(line, 1).sd).toBeGreaterThan(heightAt(line, 0.5).sd)
    })

    test("exact hit chance agrees with simulation", () => {
        const rng = createRng(3)
        for (const [targetY, mods] of [
            [0, { dBeta0: 0, dBeta1: 0, sdScale: 1 }],
            [2 * L, { dBeta0: 2 * L, dBeta1: 0, sdScale: 1 }],
            [2 * L, { dBeta0: 0, dBeta1: 0, sdScale: 1 }],
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
        const ward: Ward = { id: 1, owner: "right", x: 0.5, y: L, halfHeight: 0.6 * L }
        const shifted = attackLine(frost, { dBeta0: 2 * L, dBeta1: 0, sdScale: 1 })
        const tilted = attackLine(frost, { dBeta0: 0, dBeta1: 2 * L, sdScale: 1 })
        // Without the ward both corrections reach the target equally well...
        expect(hitChance(tilted, "left", 0, 2 * L, [])).toBeCloseTo(hitChance(shifted, "left", 0, 2 * L, []), 1)
        // ...with it, tilting runs straight into the ward while shifting passes over it.
        expect(hitChance(tilted, "left", 0, 2 * L, [ward])).toBeLessThan(0.05)
        expect(hitChance(shifted, "left", 0, 2 * L, [ward])).toBeGreaterThan(0.8)

        // Aligned wizards: only an arc (up, then back down) gets around the ward.
        const lowWard: Ward = { ...ward, y: 0 }
        expect(hitChance(attackLine(frost), "left", 0, 0, [lowWard])).toBeLessThan(0.05)
        const arc = attackLine(frost, { dBeta0: 2 * L, dBeta1: -2 * L, sdScale: 1 })
        expect(hitChance(arc, "left", 0, 0, [lowWard])).toBeGreaterThan(0.8)
    })

    test("right-side wizards shoot in their own mirrored frame", () => {
        const line = attackLine(frost, { dBeta0: 0, dBeta1: -2 * L, sdScale: 1 })
        expect(hitChance(line, "right", 2 * L, 0, [])).toBeGreaterThan(0.8)
    })
})

describe("mirrors", () => {
    const frost = getAction("frost_ray") as SpellAction
    const lightning = getAction("chain_lightning") as SpellAction
    const m = FIELD.mirror

    test("heights past a mirror fold back into the field", () => {
        expect(reflect(2 * L)).toBeCloseTo(2 * L, 9)
        expect(reflect(m + 0.3)).toBeCloseTo(m - 0.3, 9)
        expect(reflect(-m - 0.3)).toBeCloseTo(-m + 0.3, 9)
        expect(reflect(3 * m + 0.2)).toBeCloseTo(-m + 0.2, 9) // off the top, then off the bottom
    })

    test("a bank shot off the top mirror lands on a target it would otherwise miss", () => {
        // From the top lane, a slope of 2 lanes would end two lanes up; the mirror one lane above sends it back down.
        const top = FIELD.yMax
        const line = attackLine(frost, { dBeta0: 0, dBeta1: 2 * L, sdScale: 1 })
        expect(hitChance(line, "left", top, top, [])).toBeGreaterThan(0.99)
        expect(resolveShot(line, "left", top, top, [], createRng(5)).outcome).toBe("hit")
    })

    test("exact hit chance with bounces agrees with simulation (a folded normal)", () => {
        const rng = createRng(9)
        // Wide lightning along the top edge, and two steep bank shots: each folds a lot of mass back.
        for (const [casterY, targetY, dBeta1] of [
            [FIELD.yMax, FIELD.yMax, 0],
            [2 * L, 3 * L, 6 * L],
            [FIELD.yMin, FIELD.yMin + L, -4 * L],
        ] as const) {
            const line = attackLine(lightning, { dBeta0: 0, dBeta1, sdScale: 1 })
            const exact = hitChance(line, "left", casterY, targetY, [])
            let hits = 0
            const n = 40_000
            for (let i = 0; i < n; i++) if (resolveShot(line, "left", casterY, targetY, [], rng).outcome === "hit") hits++
            expect(Math.abs(hits / n - exact)).toBeLessThan(0.01)
        }
    })

    test("bounce points sit where the line meets a mirror", () => {
        const xs = bouncePoints(FIELD.yMax, 2 * L) // top lane, climbing two lanes: meets the mirror halfway
        expect(xs).toHaveLength(1)
        expect(xs[0]).toBeCloseTo(0.5, 9)
        expect(bouncePoints(0, 1.2 * L)).toHaveLength(0)
        expect(bouncePoints(0, 4 * m)).toHaveLength(2) // unfolded it climbs from 0 to 4m, crossing m and 3m
    })
})

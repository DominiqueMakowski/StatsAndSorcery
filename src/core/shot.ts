// Geometry of a cast: each wizard shoots in its own frame, where x is the distance
// travelled (0 → 1) and y is measured from the caster's own lane.

import { createRng } from "./rng"
import { foldedIntervalProb, heightAt, reflectBetween, type LineDistribution } from "./stats"
import type { AttackMods, SpellAction, CastResult, Side, Ward } from "./types"
import type { Rng } from "./rng"

export const FIELD = {
    /** Seven lanes at whole numbers, −3 … +3, so every label on the axis is an integer. */
    yMin: -3,
    yMax: 3,
    /**
     * Lanes are 1 apart, less than a hitbox is tall: one step off someone's line only partly
     * dodges them (Flame: 83% aligned, ~30% one lane off, ~1% two lanes off).
     */
    laneStep: 1,
    /** Half-height of a wizard's hitbox. */
    hitHalf: 0.72,
    /** Mirrors run along the top and bottom of the field, a lane beyond the outer lanes: spells bounce off them. */
    mirror: 4,
}

export const LANES = Array.from({ length: 7 }, (_, i) => FIELD.yMin + i * FIELD.laneStep)

export function toWorldX(side: Side, localX: number): number {
    return side === "left" ? localX : 1 - localX
}

export function toLocalX(side: Side, worldX: number): number {
    return side === "left" ? worldX : 1 - worldX
}

export function clampY(y: number): number {
    return Math.max(FIELD.yMin, Math.min(FIELD.yMax, y))
}

export const NO_MODS: AttackMods = { dBeta0: 0, dBeta1: 0, sdScale: 1 }

/** A world height after bouncing off the mirrors. */
export function reflect(y: number): number {
    return reflectBetween(y, FIELD.mirror)
}

/**
 * Local x positions (between `from` and `to`) where the line y = y0 + slope·x bounces off a mirror.
 * Unfolded, the mirrors sit at every odd multiple of FIELD.mirror.
 */
export function bouncePoints(y0: number, slope: number, from = 0, to = 1): number[] {
    if (slope === 0) return []
    const m = FIELD.mirror
    const ya = y0 + slope * from
    const yb = y0 + slope * to
    const [lo, hi] = [Math.min(ya, yb), Math.max(ya, yb)]
    const xs: number[] = []
    for (let n = Math.ceil((lo / m - 1) / 2); (2 * n + 1) * m < hi; n++) {
        const y = (2 * n + 1) * m
        if (y > lo) xs.push((y - y0) / slope)
    }
    return xs.sort((a, b) => a - b)
}

/** The distribution of the line an attack will follow, in the caster's frame. */
export function attackLine(spell: SpellAction, mods: AttackMods = NO_MODS, turnSdScale = 1): LineDistribution {
    const scale = mods.sdScale * turnSdScale
    return {
        beta0: { mean: spell.beta0.mean + mods.dBeta0, sd: spell.beta0.sd * scale },
        beta1: { mean: spell.beta1.mean + mods.dBeta1, sd: spell.beta1.sd * scale },
    }
}

/** Wards that stand between the caster and the target, nearest first, with their local x. */
function wardsInPath(side: Side, wards: Ward[]): { ward: Ward; localX: number }[] {
    return wards
        .filter((w) => w.owner !== side)
        .map((ward) => ({ ward, localX: toLocalX(side, ward.x) }))
        .filter((w) => w.localX > 0 && w.localX < 1)
        .sort((a, b) => a.localX - b.localX)
}

function traceLine(
    beta0: number,
    beta1: number,
    side: Side,
    casterY: number,
    targetY: number,
    wards: Ward[]
): Pick<CastResult, "outcome" | "endX" | "wardId"> {
    for (const { ward, localX } of wardsInPath(side, wards)) {
        const y = reflect(casterY + beta0 + beta1 * localX)
        if (Math.abs(y - ward.y) <= ward.halfHeight) return { outcome: "blocked", endX: localX, wardId: ward.id }
    }
    const impact = reflect(casterY + beta0 + beta1)
    return { outcome: Math.abs(impact - targetY) <= FIELD.hitHalf ? "hit" : "miss", endX: 1 }
}

/** Draw one realisation of the line and see where it ends up. */
export function resolveShot(line: LineDistribution, side: Side, casterY: number, targetY: number, wards: Ward[], rng: Rng): CastResult {
    const beta0 = line.beta0.mean + line.beta0.sd * rng.normal()
    const beta1 = line.beta1.mean + line.beta1.sd * rng.normal()
    return { line, sample: { beta0, beta1 }, casterY, ...traceLine(beta0, beta1, side, casterY, targetY, wards) }
}

// Common random numbers for Monte Carlo estimates: the same draws for every query,
// so comparing two plans is not blurred by sampling noise.
const MC_DRAWS = (() => {
    const rng = createRng(0x5eed)
    return Array.from({ length: 4000 }, () => [rng.normal(), rng.normal()] as const)
})()

/** Probability that a cast hits the target (exact without wards, bounces included; Monte Carlo with wards). */
export function hitChance(line: LineDistribution, side: Side, casterY: number, targetY: number, wards: Ward[]): number {
    if (wardsInPath(side, wards).length === 0) {
        const impact = heightAt(line, 1)
        // Mirrors are fixed in the world, so fold in world heights rather than the caster's frame.
        const world = { mean: casterY + impact.mean, sd: impact.sd }
        return foldedIntervalProb(world, targetY - FIELD.hitHalf, targetY + FIELD.hitHalf, FIELD.mirror)
    }
    let hits = 0
    for (const [z0, z1] of MC_DRAWS) {
        const b0 = line.beta0.mean + line.beta0.sd * z0
        const b1 = line.beta1.mean + line.beta1.sd * z1
        if (traceLine(b0, b1, side, casterY, targetY, wards).outcome === "hit") hits++
    }
    return hits / MC_DRAWS.length
}

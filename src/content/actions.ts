import type { Action } from "../core/types"

// Field geometry reminder: lanes are ½ apart (y ∈ {−1, −½, 0, ½, 1}) and a wizard's
// hitbox is ±0.18, so a shot's spread (σ at the target) of ~0.1 is "reliable" and ~0.3 is a gamble.

export const Actions: Record<string, Action> = {
    // ---- Actions: each one trades precision against power ----
    flame: {
        id: "flame",
        name: "Flame",
        kind: "spell",
        element: "fire",
        cost: 1,
        damage: 1,
        // A precise start but a wobbly angle: the band opens like a cone.
        beta0: { mean: 0, sd: 0.01 },
        beta1: { mean: 0, sd: 0.13 },
        visual: "projectile",
        description: "A mild fireball. Starts true, wobbles as it flies.",
    },
    frost_ray: {
        id: "frost_ray",
        name: "Frost Ray",
        kind: "spell",
        element: "frost",
        cost: 2,
        damage: 1,
        beta0: { mean: 0, sd: 0.02 },
        beta1: { mean: 0, sd: 0.03 },
        visual: "ray",
        description: "Slow to channel, but almost never strays.",
    },
    chain_lightning: {
        id: "chain_lightning",
        name: "Chain Lightning",
        kind: "spell",
        element: "storm",
        cost: 1,
        damage: 2,
        beta0: { mean: 0, sd: 0.14 },
        beta1: { mean: 0, sd: 0.2 },
        visual: "bolt",
        description: "Devastating, if it lands.",
    },

    // ---- Movements ----
    move: {
        id: "move",
        name: "Move",
        kind: "movement",
        element: "nature",
        cost: 1,
        step: 0.25,
        description: "Step one lane up or down.",
    },

    // ---- Alterations: change a parameter of your next spell, named as in statistics ----
    intercept: {
        id: "intercept",
        name: "Intercept",
        symbol: "β₀",
        kind: "alteration",
        element: "arcane",
        cost: 1,
        dBeta0: 0.5,
        description: "Raise or lower your next spell's intercept by ½: the whole line moves.",
    },
    slope: {
        id: "slope",
        name: "Slope",
        symbol: "β₁",
        kind: "alteration",
        element: "arcane",
        cost: 1,
        dBeta1: 0.5,
        description: "Raise or lower your next spell's slope by ½: it climbs or dips as it flies.",
    },
    halve_sd: {
        id: "halve_sd",
        name: "SD ÷ 2",
        symbol: "σ",
        kind: "alteration",
        element: "arcane",
        cost: 1,
        sdScale: 0.5,
        description: "Halve the standard deviation of your next spell: a narrower band.",
    },
    // Not in the run for now (kept simple); still listed in the action list.
    arc: {
        id: "arc",
        name: "Arc",
        symbol: "β₀+½, β₁−½",
        kind: "alteration",
        element: "arcane",
        cost: 1,
        dBeta0: 0.5,
        dBeta1: -0.5,
        description: "Intercept up, slope down, at once: lob it over a wall.",
    },

    // ---- Opponent tricks ----
    ward: {
        id: "ward",
        name: "Ward",
        kind: "ward",
        element: "shadow",
        cost: 1,
        distance: 0.5,
        halfHeight: 0.15,
        enemyOnly: true,
        description: "A wall at mid-field that absorbs one shot.",
    },
    jinx: {
        id: "jinx",
        name: "Jinx",
        symbol: "σ × 2",
        kind: "hex",
        element: "shadow",
        cost: 1,
        sdScale: 2,
        enemyOnly: true,
        description: "Doubles your opponent's standard deviation next turn.",
    },
}

export function getAction(id: string): Action {
    const action = Actions[id]
    if (!action) throw new Error(`Unknown action: ${id}`)
    return action
}

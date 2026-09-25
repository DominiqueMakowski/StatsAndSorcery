import type { Spell } from "../core/types"

// Field geometry reminder: lanes are ½ apart (y ∈ {−1, −½, 0, ½, 1}) and a wizard's
// hitbox is ±0.18, so a shot's spread (σ at the target) of ~0.1 is "reliable" and ~0.3 is a gamble.

export const Spells: Record<string, Spell> = {
    // ---- Spells: each one trades precision against power ----
    flame: {
        id: "flame",
        name: "Flame",
        kind: "attack",
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
        kind: "attack",
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
        kind: "attack",
        element: "storm",
        cost: 1,
        damage: 2,
        beta0: { mean: 0, sd: 0.14 },
        beta1: { mean: 0, sd: 0.2 },
        visual: "bolt",
        description: "Devastating, if it lands.",
    },

    // ---- Actions ----
    move: {
        id: "move",
        name: "Move",
        kind: "move",
        element: "nature",
        cost: 1,
        step: 0.5,
        description: "Step one lane up or down.",
    },

    // ---- Alterations: change the parameters of your next spell ----
    shift: {
        id: "shift",
        name: "Shift",
        symbol: "β₀",
        kind: "alteration",
        element: "arcane",
        cost: 1,
        dBeta0: 0.5,
        description: "Raise or lower where your next spell starts.",
    },
    tilt: {
        id: "tilt",
        name: "Tilt",
        symbol: "β₁",
        kind: "alteration",
        element: "arcane",
        cost: 1,
        dBeta1: 0.5,
        description: "Angle your next spell up or down.",
    },
    arc: {
        id: "arc",
        name: "Arc",
        symbol: "β₀+½, β₁−½",
        kind: "alteration",
        element: "arcane",
        cost: 1,
        dBeta0: 0.5,
        dBeta1: -0.5,
        description: "Start higher, aim down: lob it over a wall.",
    },
    focus: {
        id: "focus",
        name: "Focus",
        symbol: "σ ÷ 2",
        kind: "alteration",
        element: "arcane",
        cost: 1,
        sdScale: 0.5,
        description: "Halve the spread of your next spell.",
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
        description: "Doubles the opponent's spread next turn.",
    },
}

export function getSpell(id: string): Spell {
    const spell = Spells[id]
    if (!spell) throw new Error(`Unknown spell: ${id}`)
    return spell
}

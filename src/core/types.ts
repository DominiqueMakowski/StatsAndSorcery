import type { LineDistribution, Normal } from "./stats"

export type Side = "left" | "right"
export type Direction = 1 | -1
export type Element = "fire" | "frost" | "storm" | "arcane" | "nature" | "shadow"

interface SpellBase {
    id: string
    name: string
    /** Short statistical label shown on the card, e.g. "β₀". */
    symbol?: string
    cost: number
    element: Element
    description: string
    /** Spells only opponents can use (never offered to the player). */
    enemyOnly?: boolean
}

export interface AttackSpell extends SpellBase {
    kind: "attack"
    beta0: Normal
    beta1: Normal
    damage: number
    visual: "projectile" | "ray" | "bolt"
}

/** Alters the caster's next attack this turn. Directional modifiers ask for up/down. */
export interface ModifierSpell extends SpellBase {
    kind: "modifier"
    dBeta0?: number
    dBeta1?: number
    sdScale?: number
}

export interface MoveSpell extends SpellBase {
    kind: "move"
    step: number
}

/** Places a barrier between the wizards that absorbs one incoming shot. */
export interface WardSpell extends SpellBase {
    kind: "ward"
    /** Distance from the owner, in field units (0–1). */
    distance: number
    halfHeight: number
}

/** Scales the opponent's spread during their next turn. */
export interface HexSpell extends SpellBase {
    kind: "hex"
    sdScale: number
}

export type Spell = AttackSpell | ModifierSpell | MoveSpell | WardSpell | HexSpell

export function isDirectional(spell: Spell): boolean {
    return spell.kind === "move" || (spell.kind === "modifier" && (spell.dBeta0 !== undefined || spell.dBeta1 !== undefined))
}

export interface Card {
    uid: number
    spellId: string
}

/** One card played from the hand, with a direction when the spell needs one. */
export interface Play {
    uid: number
    dir?: Direction
}

export interface AttackMods {
    dBeta0: number
    dBeta1: number
    sdScale: number
}

export interface Ward {
    id: number
    owner: Side
    /** World x (0 = left wizard, 1 = right wizard). */
    x: number
    y: number
    halfHeight: number
}

export interface CastResult {
    line: LineDistribution
    sample: { beta0: number; beta1: number }
    casterY: number
    outcome: "hit" | "miss" | "blocked"
    /** Local x (distance from caster) where the spell stopped. */
    endX: number
    wardId?: number
}

export type DuelEvent =
    | { type: "turnStart"; side: Side; turn: number }
    | { type: "modifier"; side: Side; spellId: string; mods: AttackMods }
    | { type: "move"; side: Side; spellId: string; from: number; to: number }
    | { type: "ward"; side: Side; spellId: string; ward: Ward }
    | { type: "wardExpired"; wardId: number }
    | { type: "hex"; side: Side; spellId: string; target: Side; sdScale: number }
    | ({ type: "cast"; side: Side; spellId: string } & CastResult)
    | { type: "damage"; side: Side; amount: number; hp: number }
    | { type: "gameOver"; winner: Side }

import type { LineDistribution, Normal } from "./stats"

export type Side = "left" | "right"
export type Direction = 1 | -1
export type Element = "fire" | "frost" | "storm" | "arcane" | "nature" | "shadow"

interface ActionBase {
    id: string
    name: string
    /** Short statistical label shown on the card, e.g. "β₀". */
    symbol?: string
    cost: number
    element: Element
    description: string
    /** Actions only opponents can use (never offered to the player). */
    enemyOnly?: boolean
}

export interface SpellAction extends ActionBase {
    kind: "spell"
    beta0: Normal
    beta1: Normal
    damage: number
    visual: "projectile" | "ray" | "bolt"
}

/** Alters the parameters of the caster's next spell this turn. Directional ones ask for up/down. */
export interface AlterationAction extends ActionBase {
    kind: "alteration"
    dBeta0?: number
    dBeta1?: number
    sdScale?: number
}

export interface MovementAction extends ActionBase {
    kind: "movement"
    step: number
}

/** Places a barrier between the wizards that absorbs one incoming shot. */
export interface WardAction extends ActionBase {
    kind: "ward"
    /** Distance from the owner, in field units (0–1). */
    distance: number
    halfHeight: number
}

/** Scales the opponent's spread during their next turn. */
export interface HexAction extends ActionBase {
    kind: "hex"
    sdScale: number
}

/**
 * Every card is an action: it costs action points and has a type (its `kind`). Players have
 * spells, movements and alterations; wards and hexes are opponent tricks for now.
 */
export type Action = SpellAction | AlterationAction | MovementAction | WardAction | HexAction

export function isDirectional(action: Action): boolean {
    return action.kind === "movement" || (action.kind === "alteration" && (action.dBeta0 !== undefined || action.dBeta1 !== undefined))
}

export interface Card {
    uid: number
    actionId: string
}

/** One card played from the hand, with a direction when the action needs one. */
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
    | { type: "alteration"; side: Side; actionId: string; mods: AttackMods }
    | { type: "move"; side: Side; actionId: string; from: number; to: number }
    | { type: "ward"; side: Side; actionId: string; ward: Ward }
    | { type: "wardExpired"; wardId: number }
    | { type: "hex"; side: Side; actionId: string; target: Side; sdScale: number }
    | ({ type: "cast"; side: Side; actionId: string } & CastResult)
    | { type: "damage"; side: Side; amount: number; hp: number }
    | { type: "gameOver"; winner: Side }

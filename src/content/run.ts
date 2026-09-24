// A "run": three duels in a row, with a new spell for your book after each victory.

import { Characters, type Character } from "./characters"
import { Spells } from "./spells"

export const RUN_ENCOUNTERS = ["wendel", "lin", "outlier"] as const

/** Spells that can be offered as rewards (never enemy-only ones). */
export const REWARD_POOL = Object.values(Spells)
    .filter((s) => !s.enemyOnly)
    .map((s) => s.id)

/** Extra health the apprentice gains after each victory. */
export const HP_PER_WIN = 1

export interface RunState {
    index: number
    deck: string[]
    maxHp: number
    /** Duel statistics gathered along the way, for the summary. */
    stats: RunStats
}

export interface RunStats {
    shots: number
    hits: number
    /** Sum of the displayed hit chances of every shot: what "should" have landed. */
    expectedHits: number
    /** Shots that landed outside the 95% band. */
    outliers: number
    turns: number
}

export function newRun(): RunState {
    const you = Characters.apprentice
    return { index: 0, deck: [...you.deck], maxHp: you.hp, stats: { shots: 0, hits: 0, expectedHits: 0, outliers: 0, turns: 0 } }
}

export function runPlayer(run: RunState): Character {
    return { ...Characters.apprentice, deck: [...run.deck], hp: run.maxHp }
}

export function runEnemy(run: RunState): Character {
    return Characters[RUN_ENCOUNTERS[run.index]]
}

/** Three distinct reward options; prefers spells you don't already own. */
export function rewardChoices(run: RunState, random: () => number = Math.random): string[] {
    const owned = new Set(run.deck)
    const fresh = REWARD_POOL.filter((id) => !owned.has(id))
    const pool = [...fresh]
    const picks: string[] = []
    while (picks.length < 3 && pool.length > 0) {
        const i = Math.floor(random() * pool.length)
        picks.push(pool.splice(i, 1)[0])
    }
    // Top up with duplicates of things you own (a second Shift is still useful).
    const rest = REWARD_POOL.filter((id) => !picks.includes(id))
    while (picks.length < 3 && rest.length > 0) {
        const i = Math.floor(random() * rest.length)
        picks.push(rest.splice(i, 1)[0])
    }
    return picks
}

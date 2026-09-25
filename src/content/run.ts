// A "run": three duels in a row. You start with only Flame and Move; each win offers cards
// that prepare you for the next opponent, so the game grows one idea at a time.

import { Characters, type Character } from "./characters"

export interface RunStage {
    enemy: string
    /** Cards offered after beating this opponent (pick one). */
    rewards: string[]
}

export const RUN_STAGES: RunStage[] = [
    // Intercept or slope: Draco's walls stop straight shots.
    { enemy: "plotter", rewards: ["intercept", "slope"] },
    // Trade precision for power: Voldemode doubles your spread.
    { enemy: "malfit", rewards: ["halve_sd", "frost_ray", "chain_lightning"] },
    { enemy: "voldemode", rewards: [] },
]

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
    /** Sum of the true hit chances of every shot: what "should" have landed. */
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
    return Characters[RUN_STAGES[run.index].enemy]
}

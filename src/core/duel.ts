// The duel rules. Everything here resolves instantly and reports what happened as
// events; the UI replays those events as animations.

import { getSpell } from "../content/spells"
import type { Character } from "../content/characters"
import { createRng, shuffle, type Rng } from "./rng"
import { attackLine, clampY, hitChance, NO_MODS, resolveShot, toWorldX } from "./shot"
import type { LineDistribution } from "./stats"
import { isDirectional, type AttackMods, type Card, type DuelEvent, type Play, type Side, type Spell, type Ward } from "./types"

export interface WizardState {
    side: Side
    character: Character
    hp: number
    maxHp: number
    y: number
    ap: number
    hand: Card[]
    drawPile: Card[]
    discard: Card[]
    /** Pending changes to the next attack this turn. */
    mods: AttackMods
    /** Spread multiplier for the whole turn (from hexes). */
    turnSdScale: number
    /** Hex received, applied at the start of this wizard's next turn. */
    pendingHex: number
}

export interface DuelSetup {
    left: Character
    right: Character
    seed: number
}

export const other = (side: Side): Side => (side === "left" ? "right" : "left")

export class Duel {
    wizards: Record<Side, WizardState>
    turn: Side = "left"
    turnNumber = 0
    wards: Ward[] = []
    winner: Side | null = null

    private rng: Rng
    private nextUid = 1
    private nextWardId = 1

    constructor(setup: DuelSetup) {
        this.rng = createRng(setup.seed)
        this.wizards = {
            left: this.createWizard("left", setup.left),
            right: this.createWizard("right", setup.right),
        }
    }

    private createWizard(side: Side, character: Character): WizardState {
        const cards = character.deck.map((spellId) => ({ uid: this.nextUid++, spellId }))
        return {
            side,
            character,
            hp: character.hp,
            maxHp: character.hp,
            y: 0,
            ap: 0,
            hand: [],
            drawPile: shuffle(cards, this.rng),
            discard: [],
            mods: { ...NO_MODS },
            turnSdScale: 1,
            pendingHex: 1,
        }
    }

    get active(): WizardState {
        return this.wizards[this.turn]
    }

    start(): DuelEvent[] {
        return this.startTurn()
    }

    private startTurn(): DuelEvent[] {
        const events: DuelEvent[] = []
        const w = this.active
        this.turnNumber++
        w.ap = w.character.ap
        w.mods = { ...NO_MODS }
        w.turnSdScale = w.pendingHex
        w.pendingHex = 1

        // A wizard's wards fade when their next turn begins.
        for (const ward of this.wards.filter((wd) => wd.owner === w.side)) events.push({ type: "wardExpired", wardId: ward.id })
        this.wards = this.wards.filter((wd) => wd.owner !== w.side)

        this.draw(w)
        events.unshift({ type: "turnStart", side: w.side, turn: this.turnNumber })
        return events
    }

    private drawOne(w: WizardState): Card | undefined {
        if (w.drawPile.length === 0) {
            w.drawPile = shuffle(w.discard, this.rng)
            w.discard = []
        }
        return w.drawPile.pop()
    }

    /** Draw a fresh hand, guaranteeing at least one attack when the deck has any. */
    private draw(w: WizardState) {
        while (w.hand.length < w.character.handSize) {
            const card = this.drawOne(w)
            if (!card) break
            w.hand.push(card)
        }
        const isAttack = (c: Card) => getSpell(c.spellId).kind === "attack"
        if (w.hand.length > 0 && !w.hand.some(isAttack)) {
            const pool = [...w.drawPile, ...w.discard]
            const attack = pool.find(isAttack)
            if (attack) {
                w.drawPile = w.drawPile.filter((c) => c !== attack)
                w.discard = w.discard.filter((c) => c !== attack)
                const swapIndex = Math.floor(this.rng.next() * w.hand.length)
                w.drawPile.unshift(w.hand[swapIndex])
                w.hand[swapIndex] = attack
            }
        }
    }

    /** Why a play is not allowed right now, or null if it is. */
    whyNot(play: Play, side: Side = this.turn): string | null {
        if (this.winner) return "The duel is over"
        if (side !== this.turn) return "Not your turn"
        const w = this.wizards[side]
        const card = w.hand.find((c) => c.uid === play.uid)
        if (!card) return "Card not in hand"
        const spell = getSpell(card.spellId)
        if (spell.cost > w.ap) return "Not enough action points"
        if (isDirectional(spell) && !play.dir) return "Choose a direction"
        if (spell.kind === "move" && clampY(w.y + spell.step * play.dir!) === w.y) return "Can't move further"
        return null
    }

    play(play: Play): DuelEvent[] {
        const reason = this.whyNot(play)
        if (reason) throw new Error(reason)

        const w = this.active
        const target = this.wizards[other(w.side)]
        const card = w.hand.find((c) => c.uid === play.uid)!
        const spell = getSpell(card.spellId)
        w.hand = w.hand.filter((c) => c !== card)
        w.discard.push(card)
        w.ap -= spell.cost

        const events: DuelEvent[] = []
        switch (spell.kind) {
            case "modifier":
                applyModifier(w.mods, spell, play.dir)
                events.push({ type: "modifier", side: w.side, spellId: spell.id, mods: { ...w.mods } })
                break
            case "move": {
                const from = w.y
                w.y = clampY(w.y + spell.step * play.dir!)
                events.push({ type: "move", side: w.side, spellId: spell.id, from, to: w.y })
                break
            }
            case "ward": {
                // Placed across the straight line between the two wizards.
                const ward: Ward = {
                    id: this.nextWardId++,
                    owner: w.side,
                    x: toWorldX(w.side, spell.distance),
                    y: (w.y + target.y) / 2,
                    halfHeight: spell.halfHeight,
                }
                this.wards.push(ward)
                events.push({ type: "ward", side: w.side, spellId: spell.id, ward })
                break
            }
            case "hex":
                target.pendingHex *= spell.sdScale
                events.push({ type: "hex", side: w.side, spellId: spell.id, target: target.side, sdScale: spell.sdScale })
                break
            case "attack": {
                const line = attackLine(spell, w.mods, w.turnSdScale)
                w.mods = { ...NO_MODS }
                const result = resolveShot(line, w.side, w.y, target.y, this.wards, this.rng)
                events.push({ type: "cast", side: w.side, spellId: spell.id, ...result })
                if (result.outcome === "blocked") {
                    this.wards = this.wards.filter((wd) => wd.id !== result.wardId)
                } else if (result.outcome === "hit") {
                    target.hp = Math.max(0, target.hp - spell.damage)
                    events.push({ type: "damage", side: target.side, amount: spell.damage, hp: target.hp })
                    if (target.hp === 0) {
                        this.winner = w.side
                        events.push({ type: "gameOver", winner: w.side })
                    }
                }
                break
            }
        }
        return events
    }

    endTurn(): DuelEvent[] {
        if (this.winner) return []
        const w = this.active
        w.discard.push(...w.hand)
        w.hand = []
        this.turn = other(this.turn)
        return this.startTurn()
    }
}

function applyModifier(mods: AttackMods, spell: Extract<Spell, { kind: "modifier" }>, dir: number = 1) {
    if (spell.dBeta0) mods.dBeta0 += spell.dBeta0 * dir
    if (spell.dBeta1) mods.dBeta1 += spell.dBeta1 * dir
    if (spell.sdScale) mods.sdScale *= spell.sdScale
}

export interface AttackPreview {
    uid: number
    spellId: string
    line: LineDistribution
    casterY: number
    targetY: number
    hitChance: number
}

export interface PlanPreview {
    attacks: AttackPreview[]
    finalY: number
    apLeft: number
    /** Modifiers queued after the last attack (they would be wasted). */
    danglingMods: boolean
}

/**
 * Walk through a planned sequence of plays without rolling any dice, reporting what
 * each attack would look like. Used for the aim preview and by the AI.
 * Returns null if the plan is not playable.
 */
export function previewPlan(duel: Duel, side: Side, plays: Play[]): PlanPreview | null {
    const w = duel.wizards[side]
    const target = duel.wizards[other(side)]
    let y = w.y
    let ap = w.ap
    let mods = { ...w.mods }
    let pendingMods = false
    const attacks: AttackPreview[] = []
    const used = new Set<number>()

    for (const play of plays) {
        const card = w.hand.find((c) => c.uid === play.uid)
        if (!card || used.has(play.uid)) return null
        used.add(play.uid)
        const spell = getSpell(card.spellId)
        if (spell.cost > ap) return null
        if (isDirectional(spell) && !play.dir) return null
        ap -= spell.cost

        if (spell.kind === "modifier") {
            applyModifier(mods, spell, play.dir)
            pendingMods = true
        } else if (spell.kind === "move") {
            const next = clampY(y + spell.step * play.dir!)
            if (next === y) return null
            y = next
        } else if (spell.kind === "attack") {
            const line = attackLine(spell, mods, w.turnSdScale)
            attacks.push({
                uid: play.uid,
                spellId: spell.id,
                line,
                casterY: y,
                targetY: target.y,
                hitChance: hitChance(line, side, y, target.y, duel.wards),
            })
            mods = { ...NO_MODS }
            pendingMods = false
        }
    }
    return { attacks, finalY: y, apLeft: ap, danglingMods: pendingMods }
}

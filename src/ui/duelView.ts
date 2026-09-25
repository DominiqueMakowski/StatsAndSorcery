// Connects the duel rules to the screen: the hand, the aim preview, turn flow and the AI.

import { sfx } from "../audio/sfx"
import type { Character } from "../content/characters"
import { getAction } from "../content/actions"
import { planTurn } from "../core/ai"
import { Duel, other, previewPlan } from "../core/duel"
import { createRng, randomSeed } from "../core/rng"
import { FIELD, toLocalX } from "../core/shot"
import { ci95, heightAt } from "../core/stats"
import { isDirectional, type Direction, type DuelEvent, type Play, type Side } from "../core/types"
import type { Battlefield } from "../render/battlefield"
import { wait } from "../render/tween"
import { createCard, createCardBack } from "./cards"
import type { Coach } from "./coach"
import { renderPanel } from "./hud"
import type { RulesNote } from "./rules"

export type Mode = "pve" | "pvp"

export interface DuelSetupView {
    mode: Mode
    left: Character
    right: Character
    /** Open with the rules note: the first duel of a run, and standalone duels. Not remembered between visits. */
    withRules?: boolean
}

/** What happened during one duel, from the left (human) wizard's point of view. */
export interface DuelStats {
    shots: number
    hits: number
    expectedHits: number
    outliers: number
    turns: number
}

interface Elements {
    panels: Record<Side, HTMLElement>
    banner: HTMLElement
    hand: HTMLElement
    castBtn: HTMLButtonElement
    hint: HTMLElement
    toast: HTMLElement
}

// Number keys still pick cards (and Enter/Esc cast/clear), but the game is designed for the mouse.
const HOTKEYS = ["1", "2", "3", "4", "5", "6"]

// Planning shows no band or path: players infer where a spell will go from its card and the axes, then
// see the true band when it flies (AGENTS.md, "Learning mechanism"). `?aim` brings the preview back.
const SHOW_AIM = new URLSearchParams(location.search).has("aim")

export class DuelView {
    private duel!: Duel
    private setup!: DuelSetupView
    private queue: Play[] = []
    private hover: Play | null = null
    private busy = false
    private aiRng = createRng(randomSeed())
    private toastTimer = 0
    private stats: DuelStats = { shots: 0, hits: 0, expectedHits: 0, outliers: 0, turns: 0 }
    /** Hit chances of the queued attacks at cast time, so results can be compared with expectations. */
    private castChances = new Map<string, number>()
    /** Bumped on every start/abort so abandoned async turn loops stop at their next await. */
    private session = 0

    constructor(
        private bf: Battlefield,
        private els: Elements,
        private coach: Coach,
        private rules: RulesNote,
        private onFinish: (winner: Side, setup: DuelSetupView, stats: DuelStats) => void
    ) {
        els.castBtn.onclick = () => this.cast()
        window.addEventListener("keydown", (e) => {
            if (!this.duel || !this.isHumanTurn || this.busy) return
            if (e.target instanceof HTMLElement && e.target.tagName === "INPUT") return
            if (this.rules.isOpen && (e.key === "Enter" || e.key === "Escape")) return this.rules.hide()
            if (e.key === "Enter") return this.cast()
            if (e.key === "Escape") {
                this.queue = []
                this.refresh()
                return
            }
            const index = HOTKEYS.indexOf(e.key)
            if (index >= 0) {
                const card = this.duel.active.hand[index]
                if (!card) return
                const action = getAction(card.actionId)
                this.toggle(card.uid, isDirectional(action) ? (e.shiftKey ? -1 : 1) : undefined)
            }
        })
    }

    async start(setup: DuelSetupView) {
        this.setup = setup
        this.duel = new Duel({ left: setup.left, right: setup.right, seed: randomSeed() })
        this.queue = []
        this.hover = null
        // A winning cast ends the duel before endTurn() can unlock the hand.
        this.els.hand.classList.remove("is-locked")
        this.stats = { shots: 0, hits: 0, expectedHits: 0, outliers: 0, turns: 0 }
        this.castChances.clear()
        this.bf.showMeArrow = setup.mode === "pve"
        this.bf.setDuel(this.duel)
        this.coach.hide()
        const session = ++this.session
        this.rules.hide()
        await this.run(this.duel.start())
        if (session !== this.session) return
        this.beginTurn()
    }

    /** Reopen the rules note (the "? rules" link). */
    showRules() {
        if (this.duel) this.rules.show(this.setup.mode === "pve" ? this.duel.wizards.left.character : this.duel.active.character)
    }

    /** The duel being played (read-only access for tooling). */
    get current(): Duel {
        return this.duel
    }

    /** Abandon the current duel (back to the title screen). */
    abort() {
        this.session++
        this.busy = true
        this.coach.hide()
        this.rules.hide()
        this.bf.setPreview([])
    }

    private get isHumanTurn() {
        return this.setup.mode === "pvp" || this.duel.turn === "left"
    }

    private nameOf(side: Side) {
        const w = this.duel.wizards[side]
        return this.setup.mode === "pve" && side === "left" ? "Your" : `${w.character.name}'s`
    }

    // ---------- Event playback ----------

    private async run(events: DuelEvent[]) {
        for (const event of events) await this.apply(event)
    }

    private async apply(event: DuelEvent) {
        switch (event.type) {
            case "turnStart":
                this.els.banner.innerHTML = `<span>${this.nameOf(event.side)} turn</span>`
                this.els.banner.classList.remove("is-new")
                void this.els.banner.offsetWidth
                this.els.banner.classList.add("is-new")
                sfx.play("page")
                this.renderPanels()
                return
            case "damage":
                renderPanel(this.els.panels[event.side], this.duel, event.side, 0, event.amount)
                return
            case "gameOver":
                return
            case "cast":
                if (event.side === "left" && this.setup.mode === "pve") this.recordShot(event)
                await this.bf.play(event)
                this.renderPanels()
                if (event.side === "left" && this.setup.mode === "pve") this.coachAfterShot(event)
                return
            default:
                await this.bf.play(event)
                this.renderPanels()
        }
    }

    private recordShot(event: Extract<DuelEvent, { type: "cast" }>) {
        this.stats.shots++
        if (event.outcome === "hit") this.stats.hits++
        this.stats.expectedHits += this.castChances.get(event.actionId + ":" + this.stats.shots) ?? 0
        const impact = event.sample.beta0 + event.sample.beta1
        const [lo, hi] = ci95(heightAt(event.line, 1))
        if (impact < lo || impact > hi) this.stats.outliers++
    }

    // ---------- Turn flow ----------

    private beginTurn() {
        this.busy = false
        this.queue = []
        this.hover = null
        if (this.duel.winner) return this.finish()
        if (this.isHumanTurn) {
            this.stats.turns++
            this.refresh()
            if (this.stats.turns === 1 && this.setup.withRules) {
                // Hoot's first tip waits until the rules are out of the way (if the turn hasn't moved on).
                const session = this.session
                this.rules.show(this.duel.active.character, () => {
                    if (session === this.session && this.stats.turns === 1 && !this.busy) this.coachAtTurnStart()
                })
            } else {
                this.coachAtTurnStart()
            }
        } else {
            this.runAi()
        }
    }

    private async cast() {
        if (this.busy || !this.isHumanTurn) return
        this.busy = true
        const session = this.session
        const plays = this.queue
        const plan = previewPlan(this.duel, this.duel.turn, plays)
        this.queue = []
        this.hover = null
        this.bf.setPreview([])
        this.els.hand.classList.add("is-locked")
        this.updateControls()
        this.coach.hide()
        if (plays.length) sfx.play("scribble")

        // Remember what the odds said, in the order shots will be fired.
        let shotIndex = this.stats.shots
        for (const attack of plan?.attacks ?? []) this.castChances.set(attack.actionId + ":" + ++shotIndex, attack.hitChance)

        for (const play of plays) {
            // Pull the card out of the tray as it resolves.
            this.els.hand.querySelector(`[data-uid="${play.uid}"]`)?.remove()
            await this.run(this.duel.play(play))
            if (session !== this.session) return
            if (this.duel.winner) break
            await wait(150)
        }
        await this.endTurn(session)
    }

    private async endTurn(session: number) {
        if (session !== this.session) return
        if (this.duel.winner) return this.finish()
        await wait(250)
        if (session !== this.session) return
        this.els.hand.innerHTML = ""
        this.els.hand.classList.remove("is-locked")
        await this.run(this.duel.endTurn())
        if (session !== this.session) return
        this.beginTurn()
    }

    private async runAi() {
        this.busy = true
        const session = this.session
        const side = this.duel.turn
        this.renderBacks()
        this.updateControls()
        await wait(700)

        const plan = planTurn(this.duel, side, this.duel.wizards[side].character.sloppiness, this.aiRng)
        for (const play of plan) {
            const card = this.duel.wizards[side].hand.find((c) => c.uid === play.uid)!
            const action = getAction(card.actionId)
            const back = this.els.hand.firstElementChild
            const revealed = createCard(action, { affordable: true })
            revealed.classList.add("is-revealed")
            if (back) this.els.hand.replaceChild(revealed, back)
            sfx.play("pop")
            // Show that they're taking aim (and, with ?aim, the band they chose) before they commit.
            const preview = previewPlan(this.duel, side, [play])
            if (preview?.attacks.length) this.bf.setPreview(SHOW_AIM ? preview.attacks : [], [], null, true)
            await wait(action.kind === "spell" ? 900 : 550)
            if (session !== this.session) return
            this.bf.setPreview([])
            revealed.remove()
            await this.run(this.duel.play(play))
            if (session !== this.session) return
            if (this.duel.winner) break
            await wait(200)
        }
        await this.endTurn(session)
    }

    private finish() {
        this.busy = true
        this.bf.setPreview([])
        this.updateControls()
        this.coach.hide()
        const winner = this.duel.winner!
        const session = this.session
        this.bf.celebrate(winner)
        sfx.play(this.setup.mode === "pvp" || winner === "left" ? "win" : "lose")
        this.els.banner.innerHTML = `<span>${this.setup.mode === "pve" ? (winner === "left" ? "Victory!" : "Defeat…") : `${this.duel.wizards[winner].character.name} wins!`}</span>`
        setTimeout(() => session === this.session && this.onFinish(winner, this.setup, { ...this.stats }), 1400)
    }

    // ---------- Coaching ----------

    private coachAtTurnStart() {
        if (this.setup.mode !== "pve") return
        const me = this.duel.active
        const foe = this.duel.wizards[other(me.side)]
        const hand = me.hand.map((c) => getAction(c.actionId))
        const has = (id: string) => hand.some((s) => s.id === id)
        const wallAhead = this.duel.wards.some((w) => w.owner !== me.side && toLocalX(me.side, w.x) > 0 && toLocalX(me.side, w.x) < 1)

        if (this.stats.turns === 1) {
            this.coach.say("first", "Hoot! Guess where your Flame will land, then cast. The <b>hatched band</b> that flashes up shows where 95% of casts go.")
            return
        }
        if (me.turnSdScale > 1) {
            this.coach.say("jinxed", "You're <b>jinxed</b>: your standard deviation is doubled this turn. <b>SD ÷ 2</b> halves it back.")
            return
        }
        if (wallAhead) {
            this.coach.say("wall", "A wall at mid-field! Changing the <b>slope</b> swings your line into it; raising the <b>intercept</b> goes over it.")
            return
        }
        if (foe.y !== me.y) {
            if (has("intercept") || has("slope")) this.coach.say("offlane", "They're off your line. The <b>intercept (β₀)</b> lifts the whole line; the <b>slope (β₁)</b> angles it.")
            else if (has("move")) this.coach.say("chase", "They're off your line. Shoot anyway, or <b>Move</b> to line up first?")
            return
        }
        if (has("move") && hand.some((s) => s.kind === "spell")) {
            this.coach.say("hitrun", "You're in each other's line of fire. Try casting, <b>then Moving</b> away: they'll have to chase you.")
            return
        }
        if (has("halve_sd") && hand.some((s) => s.kind === "spell" && s.id !== "frost_ray")) {
            this.coach.say("halve_sd", "<b>SD ÷ 2</b> halves your next spell's standard deviation: a narrower band, fewer misses.")
        }
    }

    private coachAfterShot(event: Extract<DuelEvent, { type: "cast" }>) {
        const chance = this.castChances.get(event.actionId + ":" + this.stats.shots) ?? 0
        if (event.outcome === "miss" && chance >= 0.85) {
            this.coach.say("variance", `Missed at ${Math.round(chance * 100)}%? That's variance: it still misses ${Math.round((1 - chance) * 100)} times in 100.`)
        } else if (event.outcome === "hit" && chance <= 0.3) {
            this.coach.say("lucky", `A ${Math.round(chance * 100)}% shot landed! Enjoy it, but don't count on it.`)
        }
        const impact = event.sample.beta0 + event.sample.beta1
        const [lo, hi] = ci95(heightAt(event.line, 1))
        if (impact < lo || impact > hi) this.coach.say("outlier", "That one landed <b>outside the 95% band</b>. About 1 cast in 20 does.")
    }

    // ---------- Queueing cards ----------

    private toggle(uid: number, dir?: Direction) {
        if (this.busy || !this.isHumanTurn) return
        const index = this.queue.findIndex((p) => p.uid === uid)
        if (index >= 0) {
            // Unqueue, keeping as much of the rest of the plan as is still valid.
            const rest = this.queue.filter((p) => p.uid !== uid)
            this.queue = []
            for (const p of rest) if (previewPlan(this.duel, this.duel.turn, [...this.queue, p])) this.queue.push(p)
            sfx.play("poof")
        } else {
            const card = this.duel.active.hand.find((c) => c.uid === uid)
            if (!card) return
            const action = getAction(card.actionId)
            if (isDirectional(action) && !dir) return
            const candidate = this.withPlay(dir ? { uid, dir } : { uid })
            if (!previewPlan(this.duel, this.duel.turn, candidate)) {
                const apLeft = previewPlan(this.duel, this.duel.turn, this.queue)?.apLeft ?? 0
                this.toast(action.cost > apLeft ? "Not enough ★ this turn" : action.kind === "movement" ? "Can't move that way" : "Can't do that")
                return
            }
            this.queue = candidate
            sfx.play("pop")
        }
        this.hover = null
        this.refresh()
    }

    /**
     * The queue with a new play added. Alterations slot in before a trailing spell, so "Flame,
     * then Intercept" raises the Flame's intercept. Everything else keeps the order you picked: "Flame,
     * then Move" is a hit and run.
     */
    private withPlay(play: Play): Play[] {
        const actionOf = (p: Play) => getAction(this.duel.active.hand.find((c) => c.uid === p.uid)!.actionId)
        const last = this.queue.at(-1)
        if (last && actionOf(play).kind === "alteration" && actionOf(last).kind === "spell") {
            return [...this.queue.slice(0, -1), play, last]
        }
        return [...this.queue, play]
    }

    private setHover(uid: number, dir: Direction | undefined | null) {
        if (this.busy || !this.isHumanTurn) return
        this.hover = dir === null ? null : dir ? { uid, dir } : { uid }
        this.updatePreview()
    }

    private refresh() {
        this.renderHand()
        this.updatePreview()
        this.updateControls()
        this.renderPanels()
    }

    private updatePreview() {
        const side = this.duel.turn
        const plan = previewPlan(this.duel, side, this.queue)
        const committed = plan?.attacks ?? []
        const hovered = this.hover && !this.queue.some((p) => p.uid === this.hover!.uid) ? previewPlan(this.duel, side, this.withPlay(this.hover)) : null
        const finalY = (hovered ?? plan)?.finalY ?? this.duel.active.y
        const landing = finalY === this.duel.active.y ? null : finalY
        const ghost = hovered?.attacks
        if (!SHOW_AIM) return this.bf.setPreview([], [], landing, committed.length + (ghost?.length ?? 0) > 0)
        if (!ghost) return this.bf.setPreview(committed, [], landing)
        // A hovered spell adds a new ghost line; a hovered alteration or move before a spell re-aims it.
        if (ghost.length > committed.length) this.bf.setPreview(committed, ghost.slice(committed.length), landing)
        else this.bf.setPreview([], ghost, landing)
    }

    private queuedCost() {
        return this.queue.reduce((sum, p) => sum + getAction(this.duel.active.hand.find((c) => c.uid === p.uid)!.actionId).cost, 0)
    }

    private renderHand() {
        const hand = this.els.hand
        const firstRender = hand.childElementCount === 0
        hand.innerHTML = ""
        hand.classList.toggle("is-dealt", !firstRender)
        const plan = previewPlan(this.duel, this.duel.turn, this.queue)
        const apLeft = plan?.apLeft ?? 0
        const y = plan?.finalY ?? this.duel.active.y

        this.duel.active.hand.forEach((card) => {
            const action = getAction(card.actionId)
            const order = this.queue.findIndex((p) => p.uid === card.uid) + 1
            const el = createCard(action, {
                order: order || undefined,
                affordable: action.cost <= apLeft,
                dirs: isDirectional(action)
                    ? action.kind === "movement"
                        ? { up: y + action.step <= FIELD.yMax, down: y - action.step >= FIELD.yMin }
                        : { up: true, down: true }
                    : undefined,
                onPlay: (dir) => this.toggle(card.uid, dir),
                onHover: (dir) => this.setHover(card.uid, dir),
            })
            if (order) el.onclick = () => this.toggle(card.uid)
            el.dataset.uid = String(card.uid)
            hand.appendChild(el)
        })
    }

    private renderBacks() {
        this.els.hand.innerHTML = ""
        this.els.hand.classList.remove("is-dealt")
        for (let i = 0; i < this.duel.active.hand.length; i++) this.els.hand.appendChild(createCardBack())
    }

    private renderPanels() {
        const cost = this.isHumanTurn && !this.busy ? this.queuedCost() : 0
        renderPanel(this.els.panels.left, this.duel, "left", this.duel.turn === "left" ? cost : 0)
        renderPanel(this.els.panels.right, this.duel, "right", this.duel.turn === "right" ? cost : 0)
    }

    private updateControls() {
        const human = this.isHumanTurn && !this.busy && !this.duel.winner
        const btn = this.els.castBtn
        btn.disabled = !human
        btn.textContent = this.queue.length ? "Cast!" : "Pass"
        btn.classList.toggle("is-armed", this.queue.length > 0)

        let hint = ""
        if (this.duel.winner) hint = ""
        else if (!this.isHumanTurn) hint = `${this.duel.active.character.name} is thinking…`
        else if (this.busy) hint = "casting…"
        else if (previewPlan(this.duel, this.duel.turn, this.queue)?.danglingMods) hint = "alterations need a spell after them, or they're wasted"
        this.els.hint.textContent = hint
    }

    private toast(message: string) {
        const t = this.els.toast
        t.textContent = message
        t.classList.add("is-visible")
        clearTimeout(this.toastTimer)
        this.toastTimer = window.setTimeout(() => t.classList.remove("is-visible"), 1400)
    }
}

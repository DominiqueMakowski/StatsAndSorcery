// The duel arena, drawn on graph paper: ruler-drawn axes, pencil-hatched uncertainty
// bands, doodled wizards, comic-burst hits and margin scribbles.

import { sfx } from "../audio/sfx"
import { getAction } from "../content/actions"
import type { Duel, AttackPreview } from "../core/duel"
import { bouncePoints, FIELD, LANES, reflect, toWorldX } from "../core/shot"
import { heightAt, Z95, type LineDistribution } from "../core/stats"
import type { SpellAction, CastResult, DuelEvent, Element, Side, Ward } from "../core/types"
import { Particles } from "./particles"
import { boilSeed, burstPath, cloudPath, fraction, hatch, INK, jitter, roughArrow, roughEllipse, roughLine, roughPoly, scribble, starPath, withAlpha, type Pt } from "./sketch"
import { animate, ease, lerp, nextFrame, wait } from "./tween"
import { drawWizard } from "./wizard"

/** Pen colours for each element (a family of actions). */
export const ELEMENT_COLORS: Record<Element, string> = {
    fire: "#e2492b",
    frost: "#2b7fd3",
    storm: "#8146c8",
    arcane: "#1e4fa8",
    nature: "#3b9b52",
    shadow: "#c9418a",
}

const Y_VIEW = 4.2 // visible half-height in field units (the mirrors sit at ±FIELD.mirror, just inside)
/** A wizard doodle is about two lanes tall. */
const WIZARD_SIZE = 2.05
const FONT_HAND = "'Caveat', 'Patrick Hand', cursive"
const FONT_MARKER = "'Permanent Marker', 'Patrick Hand', cursive"
const POW_WORDS = ["POW!", "BAM!", "ZAP!", "WHAM!", "BONK!"]

interface WizardView {
    y: number
    /** The lane the axes are measured from: it catches up with `y` only once a hop has landed. */
    frameY: number
    /** Sideways offset in pixels (the arc of a hop). */
    dx: number
    cast: number
    flash: number
    squash: number
    scale: number
    mood?: "happy" | "sad"
}

/** The dotted pencil path a hop leaves behind, drawn up to `drawn` (0–1) and fading with `alpha`. */
interface HopTrail {
    side: Side
    from: number
    to: number
    drawn: number
    alpha: number
}

interface WardView {
    ward: Ward
    grow: number
    alpha: number
}

interface ShotView extends CastResult {
    side: Side
    color: string
    visual: SpellAction["visual"]
    charge: number
    collapse: number
    head: number
    fade: number
}

interface FloatText {
    text: string
    x: number
    y: number
    color: string
    life: number
    size: number
    font: string
    rot: number
}

interface Burst {
    x: number
    y: number
    text: string
    color: string
    fill: string
    size: number
    life: number
    pop: number
    rot: number
}

interface ImpactMark {
    x: number
    y: number
    color: string
    kind: "hit" | "miss" | "blocked"
}

interface PreviewSet {
    committed: AttackPreview[]
    ghost: AttackPreview[]
    /** Where the active wizard will stand once the planned moves are done (null: not moving). */
    landing: number | null
    /** A spell is planned, so the target's hitbox gets its red brackets. */
    aiming: boolean
}

/** Where a hop is at time t (0–1): `y` is the eased fraction of the way to the new lane, `x` a sideways bulge in pixels. */
function hopPoint(t: number): { x: number; y: number } {
    return { x: Math.sin(Math.PI * t) * 26, y: ease.inOutCubic(t) }
}

export class Battlefield {
    private ctx: CanvasRenderingContext2D
    private duel: Duel | null = null
    private views: Record<Side, WizardView> = {
        left: { y: 0, frameY: 0, dx: 0, cast: 0, flash: 0, squash: 0, scale: 1 },
        right: { y: 0, frameY: 0, dx: 0, cast: 0, flash: 0, squash: 0, scale: 1 },
    }
    private hops: HopTrail[] = []
    private wards: WardView[] = []
    private shots: ShotView[] = []
    private floats: FloatText[] = []
    private bursts: Burst[] = []
    private marks: ImpactMark[] = []
    private particles = new Particles()
    private preview: PreviewSet = { committed: [], ghost: [], landing: null, aiming: false }
    private shake = 0
    private width = 0
    private height = 0
    private time = 0
    private running = false
    /** Label for the left wizard's margin note ("me!"), shown only in solo play. */
    showMeArrow = false

    constructor(
        private canvas: HTMLCanvasElement,
        container: HTMLElement
    ) {
        this.ctx = canvas.getContext("2d")!
        new ResizeObserver(() => this.resize(container)).observe(container)
        this.resize(container)
    }

    private resize(container: HTMLElement) {
        const dpr = window.devicePixelRatio || 1
        this.width = container.clientWidth
        this.height = container.clientHeight
        this.canvas.width = Math.round(this.width * dpr)
        this.canvas.height = Math.round(this.height * dpr)
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    setDuel(duel: Duel) {
        this.duel = duel
        this.views.left = { y: duel.wizards.left.y, frameY: duel.wizards.left.y, dx: 0, cast: 0, flash: 0, squash: 0, scale: 1 }
        this.views.right = { y: duel.wizards.right.y, frameY: duel.wizards.right.y, dx: 0, cast: 0, flash: 0, squash: 0, scale: 1 }
        this.hops = []
        this.wards = []
        this.shots = []
        this.floats = []
        this.bursts = []
        this.marks = []
        this.preview = { committed: [], ghost: [], landing: null, aiming: false }
        if (!this.running) {
            this.running = true
            nextFrame(this.frame)
        }
    }

    setPreview(committed: AttackPreview[], ghost: AttackPreview[] = [], landing: number | null = null, aiming = committed.length + ghost.length > 0) {
        this.preview = { committed, ghost, landing, aiming }
    }

    /** End-of-duel expressions and confetti. */
    celebrate(winner: Side) {
        this.views[winner].mood = "happy"
        this.views[winner === "left" ? "right" : "left"].mood = "sad"
        const { left, right } = this.layout
        this.particles.confetti(left, right, this.sy(Y_VIEW), [INK.red, "#f2c230", ELEMENT_COLORS.frost, ELEMENT_COLORS.nature, ELEMENT_COLORS.storm], 60)
    }

    // ---------- Layout ----------

    private get layout() {
        const padX = Math.max(70, Math.min(150, this.width * 0.11))
        const left = padX
        const right = this.width - padX
        const unit = Math.min((this.height - 56) / (2 * Y_VIEW), (right - left) * 0.5)
        return { left, right, cy: this.height / 2, unit }
    }

    private sx(worldX: number) {
        const { left, right } = this.layout
        return left + worldX * (right - left)
    }

    private sy(worldY: number) {
        const { cy, unit } = this.layout
        return cy - worldY * unit
    }

    /** Screen position of a point on a line in the caster's frame, after any mirror bounces. */
    private linePoint(side: Side, casterY: number, b0: number, b1: number, lx: number): Pt {
        return [this.sx(toWorldX(side, lx)), this.sy(reflect(casterY + b0 + b1 * lx))]
    }

    /** The zigzag a line follows from lx0 to lx1: straight pieces with a corner at every bounce. */
    private linePath(side: Side, casterY: number, b0: number, b1: number, lx0: number, lx1: number): Pt[] {
        const xs = [lx0, ...bouncePoints(casterY + b0, b1, lx0, lx1), lx1]
        return xs.map((lx) => this.linePoint(side, casterY, b0, b1, lx))
    }

    // ---------- Event playback ----------

    async play(event: DuelEvent): Promise<void> {
        switch (event.type) {
            case "move":
                return this.playMove(event.side, event.from, event.to)
            case "alteration": {
                const m = event.mods
                const action = getAction(event.actionId)
                const label =
                    action.kind === "alteration" && action.sdScale
                        ? `σ × ${fraction(m.sdScale).replace("+", "")}`
                        : action.kind === "alteration" && action.dBeta1
                          ? `β₁ ${signed(m.dBeta1)}`
                          : `β₀ ${signed(m.dBeta0)}`
                return this.playBuff(event.side, label, ELEMENT_COLORS.arcane)
            }
            case "hex": {
                const v = this.views[event.target]
                const x = this.sx(event.target === "left" ? 0 : 1)
                this.float(`σ × ${event.sdScale}`, x, this.sy(v.y) - 70, ELEMENT_COLORS.shadow, 24)
                this.particles.burst(x, this.sy(v.y) - 20, ELEMENT_COLORS.shadow, 26, 3, ["tick", "dot"])
                await this.castPose(event.side, 350)
                return
            }
            case "ward": {
                const view: WardView = { ward: event.ward, grow: 0, alpha: 1 }
                this.wards.push(view)
                await Promise.all([this.castPose(event.side, 500), animate(500, (t) => (view.grow = t), ease.outBack)])
                return
            }
            case "wardExpired": {
                const view = this.wards.find((w) => w.ward.id === event.wardId)
                if (view) {
                    await animate(300, (t) => (view.alpha = 1 - t))
                    this.wards = this.wards.filter((w) => w !== view)
                }
                return
            }
            case "cast":
                return this.playCast(event)
            default:
                return
        }
    }

    private async castPose(side: Side, hold: number) {
        const v = this.views[side]
        await animate(160, (t) => (v.cast = t))
        await wait(hold)
        animate(250, (t) => (v.cast = 1 - t))
    }

    private async playBuff(side: Side, label: string, color: string) {
        const v = this.views[side]
        const x = this.sx(side === "left" ? 0 : 1)
        this.float(label, x + (side === "left" ? 70 : -70), this.sy(v.y) - 20, color, 26)
        sfx.play("buff")
        for (let i = 0; i < 14; i++) this.particles.trail(x + (Math.random() - 0.5) * 30, this.sy(v.y) + (Math.random() - 0.3) * 40, color, 2)
        await this.castPose(side, 250)
    }

    /**
     * A hop to the next lane: crouch, arc through the air leaving a dotted pencil trail, land with a
     * squash and a "+1". It should read at a glance who moved, which way and how far.
     */
    private async playMove(side: Side, from: number, to: number) {
        const v = this.views[side]
        const x = this.sx(side === "left" ? 0 : 1)
        const inward = side === "left" ? 1 : -1
        const color = ELEMENT_COLORS.nature
        const trail: HopTrail = { side, from, to, drawn: 0, alpha: 1 }
        this.hops.push(trail)

        await animate(140, (t) => (v.squash = 0.8 * t), ease.outCubic) // crouch
        sfx.play("hop")
        this.puff(x, this.sy(from))
        this.particles.burst(x, this.sy(from), color, 10, 2.5, ["tick"])
        await animate(560, (t) => {
            const p = hopPoint(t)
            v.y = lerp(from, to, p.y)
            v.dx = inward * p.x
            v.squash = -0.8 * Math.sin(Math.PI * t) // stretched in the air
            trail.drawn = t
            if (Math.random() < 0.45) this.particles.trail(x + v.dx, this.sy(v.y), color, 0.5)
        })
        v.y = to
        v.frameY = to
        v.dx = 0
        sfx.play("land")
        this.puff(x, this.sy(to))
        this.particles.burst(x, this.sy(to), color, 14, 3, ["tick", "star"])
        this.float(fraction(to - from), x + inward * 52, this.sy(to) - 34, color, 30, FONT_MARKER)
        await animate(240, (t) => (v.squash = 0.8 * (1 - t)), ease.outCubic) // land
        v.squash = 0
        animate(1100, (t) => (trail.alpha = 1 - t)).then(() => (this.hops = this.hops.filter((h) => h !== trail)))
    }

    /** The dotted arc a hop leaves, with an arrowhead once it has landed. */
    private drawHop(h: HopTrail) {
        const ctx = this.ctx
        const inward = h.side === "left" ? 1 : -1
        const x = this.sx(h.side === "left" ? 0 : 1)
        const pts: Pt[] = []
        for (let i = 0; i <= 18; i++) {
            const p = hopPoint((i / 18) * h.drawn)
            pts.push([x + inward * p.x, this.sy(lerp(h.from, h.to, p.y))])
        }
        ctx.save()
        ctx.globalAlpha = h.alpha * 0.85
        ctx.strokeStyle = ELEMENT_COLORS.nature
        ctx.lineWidth = 2
        ctx.lineCap = "round"
        ctx.setLineDash([5, 6])
        ctx.beginPath()
        roughPoly(ctx, pts, 321, 0.8)
        ctx.stroke()
        if (h.drawn >= 1) {
            ctx.setLineDash([])
            const [ax, ay] = pts[pts.length - 3]
            const [bx, by] = pts[pts.length - 1]
            roughArrow(ctx, ax, ay, bx, by, 322, 9)
        }
        ctx.restore()
    }

    private puff(x: number, y: number) {
        this.bursts.push({ x, y, text: "", color: INK.pencil, fill: "rgba(255,255,255,0)", size: 22, life: 1, pop: 0, rot: 0 })
        const b = this.bursts[this.bursts.length - 1]
        animate(350, (t) => (b.pop = t), ease.outBack)
    }

    private async playCast(event: Extract<DuelEvent, { type: "cast" }>) {
        const spell = getAction(event.actionId) as SpellAction
        const color = ELEMENT_COLORS[spell.element]
        const shot: ShotView = { ...event, side: event.side, color, visual: spell.visual, charge: 0, collapse: 0, head: 0, fade: 1 }
        const caster = this.views[event.side]
        const targetSide: Side = event.side === "left" ? "right" : "left"
        const target = this.views[targetSide]

        this.shots.push(shot)
        this.float(spell.name, this.sx(event.side === "left" ? 0 : 1), this.sy(caster.y) - 84, color, 22, FONT_MARKER)
        await Promise.all([animate(160, (t) => (caster.cast = t)), animate(480, (t) => (shot.charge = t))])
        // The band is the reveal: hold it long enough to compare with what you expected.
        await wait(550)
        await animate(320, (t) => (shot.collapse = t), ease.inOutCubic)
        sfx.play("whoosh")

        const travel = spell.visual === "ray" ? 320 : spell.visual === "bolt" ? 220 : 520
        await animate(travel, (t) => (shot.head = t * event.endX), spell.visual === "projectile" ? ease.inCubic : ease.outCubic)

        const [ix, iy] = this.linePoint(event.side, event.casterY, event.sample.beta0, event.sample.beta1, event.endX)
        if (event.outcome === "hit") {
            this.burst(ix, iy, POW_WORDS[Math.floor(Math.random() * POW_WORDS.length)], INK.red, INK.highlighter, 46)
            this.particles.burst(ix, iy, color, 30, 6)
            this.particles.burst(ix, iy, INK.red, 10, 4, ["star"])
            this.shake = 12
            sfx.play("hit")
            this.float(`−${spell.damage}`, ix + (targetSide === "left" ? 50 : -50), iy - 40, INK.red, 34, FONT_MARKER)
            animate(520, (t) => (target.flash = 1 - t))
            animate(500, (t) => (target.squash = 1 - t), ease.outCubic)
            this.marks.push({ x: ix, y: iy, color, kind: "hit" })
            await wait(90) // hit-stop
        } else if (event.outcome === "blocked") {
            const view = this.wards.find((w) => w.ward.id === event.wardId)
            this.burst(ix, iy, "CLANK", ELEMENT_COLORS.shadow, "rgba(255,255,255,0.7)", 34)
            this.particles.burst(ix, iy, ELEMENT_COLORS.shadow, 26, 5, ["tick", "dot"])
            this.shake = 6
            sfx.play("block")
            this.marks.push({ x: ix, y: iy, color, kind: "blocked" })
            if (view) animate(300, (t) => (view.alpha = 1 - t)).then(() => (this.wards = this.wards.filter((w) => w !== view)))
        } else {
            this.puff(ix, iy)
            sfx.play("miss")
            this.particles.burst(ix, iy, INK.pencil, 8, 2, ["tick"])
            this.float("whiff~", ix + (targetSide === "left" ? 46 : -46), iy - 10, INK.pencil, 22)
            this.marks.push({ x: ix, y: iy, color, kind: "miss" })
        }

        animate(250, (t) => (caster.cast = 1 - t))
        await animate(650, (t) => (shot.fade = 1 - t))
        this.shots = this.shots.filter((s) => s !== shot)
    }

    announce(side: Side, text: string, color = INK.pen) {
        this.float(text, this.sx(side === "left" ? 0 : 1), this.sy(this.views[side].y) - 100, color, 22)
    }

    private float(text: string, x: number, y: number, color: string, size: number, font = FONT_HAND) {
        this.floats.push({ text, x, y, color, life: 1, size, font, rot: (Math.random() - 0.5) * 0.2 })
    }

    private burst(x: number, y: number, text: string, color: string, fill: string, size: number) {
        const b: Burst = { x, y, text, color, fill, size, life: 1, pop: 0, rot: (Math.random() - 0.5) * 0.5 }
        this.bursts.push(b)
        animate(320, (t) => (b.pop = t), ease.outBack)
    }

    // ---------- Drawing ----------

    private frame = (now: number) => {
        // Elapsed time in 60 fps frames, capped so a backgrounded tab doesn't jump.
        const step = Math.min(3, ((now - this.time * 1000) / 1000) * 60)
        this.time = now / 1000
        this.draw(step)
        nextFrame(this.frame)
    }

    private draw(step: number) {
        const ctx = this.ctx
        ctx.clearRect(0, 0, this.width, this.height)
        if (!this.duel) return

        ctx.save()
        if (this.shake > 0.3) {
            ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake)
            this.shake *= 0.86 ** step
        }

        this.drawMarginalia()
        this.drawAxes()
        this.drawMarks()
        for (const w of this.wards) this.drawWard(w)
        this.drawPreviews()
        this.drawLanding()
        for (const h of this.hops) this.drawHop(h)
        this.drawWizards()
        this.drawTargetZone()
        for (const shot of this.shots) this.drawShot(shot)

        this.particles.update(step)
        this.particles.draw(ctx)
        this.drawBursts(step)
        this.drawFloats(step)
        ctx.restore()
    }

    /** Idle scribbles in the margins: the bored-in-class part. */
    private drawMarginalia() {
        const ctx = this.ctx
        const { left, right } = this.layout
        const top = this.sy(Y_VIEW)
        const bottom = this.sy(-Y_VIEW)
        const seed = 4242
        ctx.save()
        ctx.globalAlpha = 0.38
        ctx.strokeStyle = INK.pencil
        ctx.fillStyle = INK.pencil
        ctx.lineWidth = 1.4
        ctx.lineCap = "round"

        // The formula, top-left, tilted like a margin note.
        ctx.save()
        ctx.translate(left + 8, top - 14)
        ctx.rotate(-0.05)
        ctx.font = `700 19px ${FONT_HAND}`
        ctx.textAlign = "left"
        ctx.textBaseline = "alphabetic"
        ctx.fillText("y = β₀ + β₁·x", 0, 0)
        ctx.beginPath()
        roughLine(ctx, 0, 5, 118, 6, seed, 1, 1)
        ctx.stroke()
        ctx.restore()

        // Stars and a moon, top-right.
        for (let i = 0; i < 3; i++) {
            starPath(ctx, right - 30 - i * 22, top - 18 + jitter(seed, i) * 6, 5 + i, seed + i)
            ctx.stroke()
        }
        ctx.beginPath()
        ctx.arc(right - 100, top - 16, 9, 0.6, 5.2)
        ctx.stroke()

        // A sleepy sun, bottom-right.
        const sx = right - 26
        const sy = bottom + 20
        ctx.beginPath()
        roughEllipse(ctx, sx, sy, 9, 9, seed + 7, 0.8)
        ctx.stroke()
        ctx.beginPath()
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2
            roughLine(ctx, sx + Math.cos(a) * 12, sy + Math.sin(a) * 12, sx + Math.cos(a) * 17, sy + Math.sin(a) * 17, seed + i, 0.5, 1)
        }
        ctx.stroke()
        ctx.font = `700 14px ${FONT_HAND}`
        ctx.textAlign = "left"
        ctx.fillText("z z z", sx - 60, sy - 6)

        // "stats ♥ sorcery" bottom-left, with a scribbled underline.
        ctx.font = `700 16px ${FONT_HAND}`
        ctx.fillText("stats ♥ sorcery", left - 4, bottom + 26)
        ctx.beginPath()
        for (let i = 0; i < 2; i++) roughLine(ctx, left - 4, bottom + 30 + i * 3, left + 96, bottom + 31 + i * 2, seed + 20 + i, 1.2, 1)
        ctx.stroke()

        // "me!" arrow above the left axis, solo play only.
        if (this.showMeArrow) {
            ctx.font = `700 18px ${FONT_HAND}`
            ctx.fillText("me!", left - 46, top + 6)
            ctx.strokeStyle = INK.pencil
            roughArrow(ctx, left - 26, top + 10, left - 6, top + 22, seed + 30, 6)
        }
        ctx.restore()
    }

    private drawAxes() {
        const ctx = this.ctx
        const { left, right } = this.layout
        const top = this.sy(Y_VIEW)
        const bottom = this.sy(-Y_VIEW)
        const frame = this.duel!.turn
        const caster = this.views[frame]
        const seed = 77 // static: a ruler-drawn axis shouldn't boil
        ctx.save()
        ctx.lineCap = "round"

        // Lane guides: faint pencil dashes.
        ctx.lineWidth = 1
        ctx.setLineDash([7, 7])
        ctx.strokeStyle = withAlpha(INK.pencil, 0.35)
        ctx.beginPath()
        for (const y of LANES) roughLine(ctx, left, this.sy(y), right, this.sy(y), seed + y * 10, 0.8, 1)
        ctx.stroke()
        // Mirrors along the top and bottom edges, hatched on the back like in a physics diagram.
        ctx.setLineDash([])
        ctx.strokeStyle = withAlpha(INK.pen, 0.75)
        for (const s of [1, -1]) {
            const y = this.sy(s * FIELD.mirror)
            ctx.lineWidth = 2
            ctx.beginPath()
            roughLine(ctx, left, y, right, y, seed + 40 + s, 0.5, 1)
            ctx.stroke()
            ctx.lineWidth = 1
            ctx.beginPath()
            for (let x = left + 6; x < right; x += 12) roughLine(ctx, x, y, x + 7, y - s * 7, seed + x, 0.3, 1)
            ctx.stroke()
        }
        ctx.fillStyle = withAlpha(INK.pen, 0.55)
        ctx.font = `700 13px ${FONT_HAND}`
        ctx.textAlign = "right"
        ctx.textBaseline = "top"
        ctx.fillText("mirror", right - 8, this.sy(-FIELD.mirror) + 9)
        ctx.textBaseline = "bottom"
        ctx.fillText("mirror", right - 8, this.sy(FIELD.mirror) - 9)

        // Mid-field, dotted.
        ctx.strokeStyle = withAlpha(INK.pencil, 0.35)
        ctx.lineWidth = 1
        ctx.setLineDash([2, 6])
        ctx.beginPath()
        roughLine(ctx, this.sx(0.5), top, this.sx(0.5), bottom, seed + 5, 0.8, 1)
        ctx.stroke()
        ctx.setLineDash([])

        // The active caster's x-axis: their own lane, in pen, with an arrow toward the target.
        const onLeft = frame === "left"
        const ax0 = onLeft ? left : right
        const ax1 = onLeft ? right : left
        ctx.strokeStyle = withAlpha(INK.pen, 0.7)
        ctx.lineWidth = 1.6
        roughArrow(ctx, ax0, this.sy(caster.frameY), ax1 + (onLeft ? 26 : -26), this.sy(caster.frameY), seed + 6, 9)
        // Tick marks for x = 0, ½, 1
        ctx.beginPath()
        for (const lx of [0.5, 1]) {
            const x = this.sx(toWorldX(frame, lx))
            roughLine(ctx, x, this.sy(caster.frameY) - 5, x, this.sy(caster.frameY) + 5, seed + lx * 10, 0.4, 1)
        }
        ctx.stroke()

        // Wizard axes (y), in pen.
        ctx.strokeStyle = withAlpha(INK.pen, 0.7)
        ctx.lineWidth = 1.6
        ctx.beginPath()
        roughLine(ctx, left, top, left, bottom, seed + 8, 1)
        roughLine(ctx, right, top, right, bottom, seed + 9, 1)
        for (const lane of LANES) {
            for (const x of [left, right]) roughLine(ctx, x - 5, this.sy(lane), x + 5, this.sy(lane), seed + lane * 3, 0.4, 1)
        }
        ctx.stroke()

        // Labels in the active caster's frame, handwritten.
        ctx.font = `700 17px ${FONT_HAND}`
        ctx.textBaseline = "middle"
        ctx.textAlign = onLeft ? "right" : "left"
        const offset = 14
        const lx = onLeft ? left - offset : right + offset
        for (const lane of LANES) {
            const rel = lane - caster.frameY
            const isZero = Math.abs(rel) < 1e-6
            ctx.fillStyle = isZero ? INK.pen : withAlpha(INK.pen, 0.55)
            ctx.fillText(isZero ? "0" : fraction(rel), lx, this.sy(lane))
        }
        ctx.textAlign = "center"
        ctx.textBaseline = "top"
        ctx.fillStyle = withAlpha(INK.pen, 0.6)
        for (const [x, label] of [
            [0, "0"],
            [0.5, "½"],
            [1, "1"],
        ] as const) {
            const wx = this.sx(toWorldX(frame, x))
            // Keep labels off the wizards' feet by placing them just below the caster's lane.
            ctx.fillText(label, wx, this.sy(caster.frameY) + 8)
        }
        ctx.font = `italic 700 16px ${FONT_HAND}`
        ctx.fillText("x", ax1 + (onLeft ? 30 : -30), this.sy(caster.frameY) - 22)
        ctx.restore()
    }

    /** A pencil ghost of yourself where your planned moves will leave you, with an arrow from here. */
    private drawLanding() {
        const y = this.preview.landing
        if (y === null || !this.duel) return
        const ctx = this.ctx
        const side = this.duel.turn
        const facing = side === "left" ? 1 : -1
        const x = this.sx(side === "left" ? 0 : 1)
        const { unit } = this.layout
        ctx.save()
        ctx.globalAlpha = 0.3
        drawWizard(ctx, this.duel.wizards[side].character.look, x, this.sy(y), unit * WIZARD_SIZE, facing, { time: this.time, cast: 0, flash: 0, squash: 0, active: false })
        ctx.globalAlpha = 0.75
        ctx.strokeStyle = INK.pencil
        ctx.lineWidth = 1.6
        ctx.setLineDash([4, 4])
        const from = this.sy(this.views[side].y)
        const to = this.sy(y)
        const ax = x - facing * unit * 0.7
        roughArrow(ctx, ax, from, ax, to + Math.sign(from - to) * 6, boilSeed(this.time, 6), 6)
        ctx.restore()
    }

    private drawWizards() {
        if (!this.duel) return
        const { unit } = this.layout
        for (const side of ["left", "right"] as const) {
            const v = this.views[side]
            const look = this.duel.wizards[side].character.look
            drawWizard(this.ctx, look, this.sx(side === "left" ? 0 : 1) + v.dx, this.sy(v.y), unit * WIZARD_SIZE * v.scale, side === "left" ? 1 : -1, {
                time: this.time,
                cast: v.cast,
                flash: v.flash,
                squash: v.squash,
                active: this.duel.turn === side && !this.duel.winner,
                mood: v.mood,
            })
        }
    }

    /**
     * A one-way wall: it stops the opponent's spells but lets its owner's through. The face toward
     * the opponent is a solid pen line with dense hatching; the shading fades out toward the owner,
     * whose side is dashed, and two chevrons point the way spells can pass. (A pencil gradient:
     * the art direction rules out real ones.)
     */
    private drawWard(view: WardView) {
        const ctx = this.ctx
        const { ward } = view
        const x = this.sx(ward.x)
        const h = ward.halfHeight * view.grow
        const y0 = this.sy(ward.y + h)
        const y1 = this.sy(ward.y - h)
        const w = 26
        // Direction from the wall toward the side it blocks (the owner's opponent).
        const toFoe = ward.owner === "right" ? -1 : 1
        const face = x + (toFoe * w) / 2
        const back = x - (toFoe * w) / 2
        const seed = boilSeed(this.time, 4) + ward.id * 17
        const color = ELEMENT_COLORS.shadow
        ctx.save()
        ctx.globalAlpha = view.alpha
        ctx.lineCap = "round"

        // Pencil shading in columns: dark and tight at the face, faint and sparse toward the back.
        const cols = 7
        for (let c = 0; c < cols; c++) {
            const u = c / (cols - 1)
            const cx = lerp(face, back, u)
            ctx.strokeStyle = withAlpha(color, 0.9 * (1 - u) ** 1.4 + 0.04)
            ctx.lineWidth = 1.2
            ctx.beginPath()
            for (let yy = y0 + 3; yy < y1 - 2; yy += 4 + u * 7) roughLine(ctx, cx - 2, yy + 2, cx + 2, yy - 2, seed + c * 13 + Math.round(yy), 0.3, 1)
            ctx.stroke()
        }

        // The blocking face, solid; the top and bottom, solid near the face; the owner's side, dashed.
        ctx.strokeStyle = color
        ctx.lineWidth = 2.8
        ctx.beginPath()
        roughLine(ctx, face, y0, face, y1, seed + 1, 0.8, 1)
        ctx.stroke()
        ctx.lineWidth = 1.6
        ctx.beginPath()
        roughLine(ctx, face, y0, back, y0, seed + 2, 0.6, 1)
        roughLine(ctx, face, y1, back, y1, seed + 3, 0.6, 1)
        ctx.stroke()
        ctx.lineWidth = 1.3
        ctx.setLineDash([3, 4])
        ctx.beginPath()
        roughLine(ctx, back, y0, back, y1, seed + 4, 0.6, 1)
        ctx.stroke()
        ctx.setLineDash([])

        // Chevrons on the faint side: the owner's spells pass this way.
        ctx.lineWidth = 1.6
        ctx.beginPath()
        for (const k of [0.3, 0.7]) {
            const cy = lerp(y0, y1, k)
            const cx = lerp(face, back, 0.62)
            roughPoly(
                ctx,
                [
                    [cx - toFoe * 3, cy - 5],
                    [cx + toFoe * 3, cy],
                    [cx - toFoe * 3, cy + 5],
                ],
                seed + 5 + k * 10,
                0.3
            )
        }
        ctx.stroke()
        ctx.restore()
    }

    /** Points of the 95% band of a line in the caster's frame, from lx = 0 to `until`. */
    private bandPoints(side: Side, casterY: number, line: LineDistribution, until = 1, collapseTo?: { b0: number; b1: number; t: number }) {
        const steps = 28
        const upper: Pt[] = []
        const lower: Pt[] = []
        for (let i = 0; i <= steps; i++) {
            const lx = (i / steps) * until
            const h = heightAt(line, lx)
            let hi = h.mean + Z95 * h.sd
            let lo = h.mean - Z95 * h.sd
            if (collapseTo) {
                const s = collapseTo.b0 + collapseTo.b1 * lx
                hi = lerp(hi, s, collapseTo.t)
                lo = lerp(lo, s, collapseTo.t)
            }
            upper.push([this.sx(toWorldX(side, lx)), this.sy(casterY + hi)])
            lower.push([this.sx(toWorldX(side, lx)), this.sy(casterY + lo)])
        }
        return { upper, lower, polygon: [...upper, ...[...lower].reverse()] }
    }

    /**
     * The band after bouncing: the unfolded band plus its reflection in each mirror, clipped to the
     * space between them. That union is exactly where the band's heights end up once folded.
     */
    private drawBand(polygon: Pt[], upper: Pt[], lower: Pt[], color: string, seed: number, alpha: number) {
        const ctx = this.ctx
        const top = this.sy(FIELD.mirror)
        const bottom = this.sy(-FIELD.mirror)
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, top, this.width, bottom - top)
        ctx.clip()
        for (const flip of [(y: number) => y, (y: number) => 2 * top - y, (y: number) => 2 * bottom - y]) {
            const ys = polygon.map(([, y]) => flip(y))
            if (Math.max(...ys) < top || Math.min(...ys) > bottom) continue
            const map = (pts: Pt[]) => pts.map(([x, y]): Pt => [x, flip(y)])
            this.drawBandImage(map(polygon), map(upper), map(lower), color, seed, alpha)
        }
        ctx.restore()
    }

    private drawBandImage(polygon: Pt[], upper: Pt[], lower: Pt[], color: string, seed: number, alpha: number) {
        const ctx = this.ctx
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.lineCap = "round"
        // Coloured-pencil hatching inside the band.
        ctx.fillStyle = withAlpha(color, 0.08)
        ctx.beginPath()
        polygon.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = withAlpha(color, 0.5)
        ctx.lineWidth = 1
        hatch(ctx, polygon, 7, -0.85, seed, 1.2)
        // Dashed pencil edges.
        ctx.strokeStyle = withAlpha(color, 0.85)
        ctx.lineWidth = 1.3
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        roughPoly(ctx, upper, seed + 1, 0.8)
        roughPoly(ctx, lower, seed + 2, 0.8)
        ctx.stroke()
        ctx.restore()
    }

    private drawPreviews() {
        const all = [...this.preview.committed.map((p) => ({ p, ghost: false })), ...this.preview.ghost.map((p) => ({ p, ghost: true }))]
        if (all.length === 0 || !this.duel) return
        const ctx = this.ctx
        const side = this.duel.turn
        const seed = boilSeed(this.time, 6)

        let i = 0
        for (const { p, ghost } of all) {
            const spell = getAction(p.actionId)
            const color = ELEMENT_COLORS[spell.element]
            const { upper, lower, polygon } = this.bandPoints(side, p.casterY, p.line)
            this.drawBand(polygon, upper, lower, color, seed + i * 7, ghost ? 0.45 : 0.9)

            // Expected path: marching pen dashes toward the target, bouncing off the mirrors.
            const path = this.linePath(side, p.casterY, p.line.beta0.mean, p.line.beta1.mean, 0, 1)
            ctx.save()
            ctx.globalAlpha = ghost ? 0.5 : 1
            ctx.lineCap = "round"
            ctx.setLineDash([12, 9])
            ctx.lineDashOffset = -this.time * 40 * (side === "left" ? 1 : -1)
            ctx.strokeStyle = color
            ctx.lineWidth = 2.4
            ctx.beginPath()
            roughPoly(ctx, path, seed + i, 1.2)
            ctx.stroke()
            ctx.restore()
            // No hit-% label on purpose: judging the odds from the band is the skill being trained.
            i++
        }
    }

    /** Red-pen brackets around the target's hitbox while aiming. */
    private drawTargetZone() {
        if (!this.duel || !this.preview.aiming) return
        const ctx = this.ctx
        const targetSide: Side = this.duel.turn === "left" ? "right" : "left"
        const tv = this.views[targetSide]
        const tx = this.sx(targetSide === "left" ? 0 : 1)
        const w = 32
        const zy0 = this.sy(tv.y + FIELD.hitHalf)
        const zy1 = this.sy(tv.y - FIELD.hitHalf)
        const seed = boilSeed(this.time, 5)
        ctx.save()
        ctx.strokeStyle = INK.red
        ctx.lineWidth = 2.2
        ctx.lineCap = "round"
        ctx.beginPath()
        roughLine(ctx, tx - w + 8, zy0, tx - w, zy0, seed, 0.6, 1)
        roughLine(ctx, tx - w, zy0, tx - w, zy1, seed + 1, 0.8, 1)
        roughLine(ctx, tx - w, zy1, tx - w + 8, zy1, seed + 2, 0.6, 1)
        roughLine(ctx, tx + w - 8, zy0, tx + w, zy0, seed + 3, 0.6, 1)
        roughLine(ctx, tx + w, zy0, tx + w, zy1, seed + 4, 0.8, 1)
        roughLine(ctx, tx + w, zy1, tx + w - 8, zy1, seed + 5, 0.6, 1)
        ctx.stroke()
        ctx.restore()
    }

    /** Where past shots landed: little pen crosses that build up a histogram over the duel. */
    private drawMarks() {
        const ctx = this.ctx
        if (this.marks.length === 0) return
        ctx.save()
        ctx.lineCap = "round"
        const recent = this.marks.slice(-24)
        recent.forEach((m, i) => {
            const age = recent.length - 1 - i
            ctx.globalAlpha = Math.max(0.2, 0.75 - age * 0.03)
            ctx.strokeStyle = m.kind === "miss" ? INK.pencil : m.color
            ctx.lineWidth = m.kind === "hit" ? 2 : 1.4
            const r = m.kind === "hit" ? 5 : 4
            ctx.beginPath()
            if (m.kind === "blocked") {
                roughEllipse(ctx, m.x, m.y, r, r, i, 0.4)
            } else {
                roughLine(ctx, m.x - r, m.y - r, m.x + r, m.y + r, i, 0.4, 1)
                roughLine(ctx, m.x + r, m.y - r, m.x - r, m.y + r, i + 1, 0.4, 1)
            }
            ctx.stroke()
        })
        ctx.restore()
    }

    private drawShot(shot: ShotView) {
        const ctx = this.ctx
        const { side, casterY, line, sample } = shot
        const seed = boilSeed(this.time, 12) + 500
        ctx.save()
        ctx.lineCap = "round"
        ctx.lineJoin = "round"

        // Uncertainty band grows out of the caster, then collapses onto the drawn line.
        if (shot.collapse < 1) {
            const { upper, lower, polygon } = this.bandPoints(side, casterY, line, shot.charge, { b0: sample.beta0, b1: sample.beta1, t: shot.collapse })
            this.drawBand(polygon, upper, lower, shot.color, seed, 1 - shot.collapse * 0.5)
        }

        const point = (lx: number) => this.linePoint(side, casterY, sample.beta0, sample.beta1, lx)
        if (shot.collapse > 0) {
            // Faint pencil guide of the realised line
            ctx.globalAlpha = shot.collapse * 0.4 * shot.fade
            ctx.strokeStyle = shot.color
            ctx.lineWidth = 1
            ctx.setLineDash([4, 4])
            ctx.beginPath()
            roughPoly(ctx, this.linePath(side, casterY, sample.beta0, sample.beta1, 0, shot.endX), 9, 0.8)
            ctx.stroke()
            ctx.setLineDash([])
        }

        if (shot.head > 0) {
            const [x0, y0] = point(0)
            const [hx, hy] = point(shot.head)
            ctx.globalAlpha = shot.fade
            // Direction of travel right now: after a bounce it isn't the direction from the caster.
            const [bx, by] = point(Math.max(0, shot.head - 0.02))
            const dir = shot.head > 0.02 ? Math.atan2(hy - by, hx - bx) : Math.atan2(hy - y0, hx - x0)

            if (shot.visual === "ray") {
                // Two pen lines with little snowflake asterisks along them, one straight piece per bounce.
                const path = this.linePath(side, casterY, sample.beta0, sample.beta1, 0, shot.head)
                ctx.strokeStyle = shot.color
                for (let i = 1; i < path.length; i++) {
                    const [ax, ay] = path[i - 1]
                    const [ex, ey] = path[i]
                    const d = Math.atan2(ey - ay, ex - ax)
                    const nx = -Math.sin(d) * 4
                    const ny = Math.cos(d) * 4
                    ctx.lineWidth = 2.2
                    ctx.beginPath()
                    roughLine(ctx, ax + nx, ay + ny, ex + nx, ey + ny, seed + i * 5 + 1, 1, 1)
                    roughLine(ctx, ax - nx, ay - ny, ex - nx, ey - ny, seed + i * 5 + 2, 1, 1)
                    ctx.stroke()
                    ctx.lineWidth = 1.3
                    ctx.beginPath()
                    const len = Math.hypot(ex - ax, ey - ay)
                    for (let s = 24; s < len; s += 34) {
                        const px = ax + Math.cos(d) * s
                        const py = ay + Math.sin(d) * s
                        for (let k = 0; k < 3; k++) {
                            const a = (k / 3) * Math.PI + this.time * 3
                            roughLine(ctx, px - Math.cos(a) * 5, py - Math.sin(a) * 5, px + Math.cos(a) * 5, py + Math.sin(a) * 5, seed + s + k, 0.3, 1)
                        }
                    }
                    ctx.stroke()
                }
            } else if (shot.visual === "bolt") {
                // A jagged pen zigzag that redraws every frame.
                ctx.strokeStyle = shot.color
                ctx.lineWidth = 3
                ctx.beginPath()
                ctx.moveTo(x0, y0)
                const n = 14
                const fseed = Math.floor(this.time * 30)
                for (let i = 1; i <= n; i++) {
                    const [px, py] = point((shot.head * i) / n)
                    const j = i === n ? 0 : jitter(fseed, i) * 14
                    ctx.lineTo(px - Math.sin(dir) * j, py + Math.cos(dir) * j)
                }
                ctx.stroke()
                ctx.strokeStyle = withAlpha(INK.highlighter, 0.9)
                ctx.lineWidth = 1.2
                ctx.stroke()
            } else {
                // Fireball: a scribbled blob with a flame tail.
                const tailLen = 34
                ctx.strokeStyle = shot.color
                ctx.lineWidth = 1.6
                for (let k = -1; k <= 1; k++) {
                    const tx = hx - Math.cos(dir) * tailLen * (1 - Math.abs(k) * 0.35) - Math.sin(dir) * k * 6
                    const ty = hy - Math.sin(dir) * tailLen * (1 - Math.abs(k) * 0.35) + Math.cos(dir) * k * 6
                    ctx.beginPath()
                    roughLine(ctx, hx - Math.cos(dir) * 6, hy - Math.sin(dir) * 6, tx, ty, seed + k + 10, 2, 1)
                    ctx.stroke()
                }
                if (shot.head < shot.endX) {
                    ctx.strokeStyle = "#f2c230"
                    ctx.lineWidth = 2.2
                    scribble(ctx, hx, hy, 10, seed, 6)
                    ctx.strokeStyle = shot.color
                    ctx.lineWidth = 2
                    ctx.beginPath()
                    roughEllipse(ctx, hx, hy, 10, 9, seed + 3, 1.2)
                    ctx.stroke()
                }
            }
            if (shot.head < shot.endX && shot.fade === 1) {
                for (let i = 0; i < 2; i++) this.particles.trail(hx, hy, shot.color)
            }
        }
        ctx.restore()
    }

    private drawBursts(step: number) {
        const ctx = this.ctx
        ctx.save()
        ctx.lineJoin = "round"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        for (const b of this.bursts) {
            b.life -= 0.016 * step
            const scale = b.pop
            ctx.save()
            ctx.globalAlpha = Math.min(1, b.life * 2)
            ctx.translate(b.x, b.y)
            ctx.rotate(b.rot)
            ctx.scale(scale, scale)
            if (b.text) {
                burstPath(ctx, 0, 0, b.size, b.size * 0.62, 11, 17)
                ctx.fillStyle = b.fill
                ctx.fill()
                ctx.strokeStyle = b.color
                ctx.lineWidth = 2.4
                ctx.stroke()
                ctx.fillStyle = b.color
                ctx.font = `${b.size * 0.5}px ${FONT_MARKER}`
                ctx.fillText(b.text, 0, 1)
            } else {
                // A pencil "poof" cloud.
                cloudPath(ctx, 0, 0, b.size * 2, b.size * 1.5, 23)
                ctx.strokeStyle = b.color
                ctx.lineWidth = 1.4
                ctx.stroke()
            }
            ctx.restore()
        }
        this.bursts = this.bursts.filter((b) => b.life > 0)
        ctx.restore()
    }

    private drawFloats(step: number) {
        const ctx = this.ctx
        ctx.save()
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        for (const f of this.floats) {
            f.life -= 0.011 * step
            f.y -= 0.5 * step
            ctx.save()
            ctx.globalAlpha = Math.min(1, f.life * 2)
            ctx.translate(f.x, f.y)
            ctx.rotate(f.rot)
            ctx.font = `700 ${f.size}px ${f.font}`
            ctx.fillStyle = f.color
            ctx.fillText(f.text, 0, 0)
            ctx.restore()
        }
        this.floats = this.floats.filter((f) => f.life > 0)
        ctx.restore()
    }
}

function signed(v: number): string {
    return Math.abs(v) < 1e-6 ? "0" : fraction(v)
}

/** Handwritten-friendly numbers: ½ instead of 0.5. */

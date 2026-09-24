// Wizards are ballpoint doodles: big round head, dot eyes, a robe shaded with coloured
// pencil, a hat and a staff. Everything is drawn with wobbly lines that "boil".

import type { CharacterLook } from "../content/characters"
import { boilSeed, hatch, roughEllipse, roughLine, roughPoly, starPath, withAlpha, type Pt } from "./sketch"

export interface WizardPose {
    /** Seconds since start, for idle motion and line boil. */
    time: number
    /** 0–1: arm raised to cast. */
    cast: number
    /** 0–1: just got hit (× eyes, wobble). */
    flash: number
    /** 0–1: squash on impact. */
    squash: number
    active: boolean
    /** Optional expressions at the end of a duel. */
    mood?: "happy" | "sad"
}

/**
 * Draw a wizard centred on (x, y), `height` px tall, facing +1 (right) or −1 (left).
 * Local units: the figure spans roughly y ∈ [−72, 46].
 */
export function drawWizard(ctx: CanvasRenderingContext2D, look: CharacterLook, x: number, y: number, height: number, facing: 1 | -1, pose: WizardPose) {
    const s = height / 118
    const seed = boilSeed(pose.time) * 31 + (facing > 0 ? 3 : 977)
    const bob = Math.sin(pose.time * 2.4 + (facing > 0 ? 0 : 1.7)) * 1.6
    const hitWobble = pose.flash > 0 ? Math.sin(pose.time * 40) * pose.flash * 4 : 0
    const ink = look.ink
    const lw = Math.max(1.4, 2.1 * s)

    ctx.save()
    ctx.translate(x, y)

    // Ground: a pencil scribble shadow, and a highlighter ring under the active wizard.
    if (pose.active) {
        ctx.strokeStyle = withAlpha("#ffd400", 0.55)
        ctx.lineWidth = 7 * s
        ctx.beginPath()
        roughEllipse(ctx, 0, 47 * s, 34 * s, 8 * s, seed + 5, 1.5)
        ctx.stroke()
    }
    ctx.strokeStyle = withAlpha("#7a7a7a", 0.35)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    for (let i = 0; i < 5; i++) roughLine(ctx, (-20 + i * 2) * s, (44 + i * 1.5) * s, (16 + i * 2) * s, (44 + i * 1.5) * s, seed + i, 1, 1)
    ctx.stroke()

    ctx.translate(hitWobble * s, bob * s)
    ctx.scale(s * facing * (1 + pose.squash * 0.16), s * (1 - pose.squash * 0.12))
    ctx.translate(0, pose.squash * 5)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineWidth = lw / s

    const stroke = (fn: () => void, color = ink, width = lw / s) => {
        ctx.strokeStyle = color
        ctx.lineWidth = width
        ctx.beginPath()
        fn()
        ctx.stroke()
    }
    const pencilFill = (pts: Pt[], color: string, gap = 5, angle = -0.8, alpha = 0.32) => {
        ctx.fillStyle = withAlpha(color, alpha)
        ctx.beginPath()
        roughPoly(ctx, pts, seed + 40, 0.6, true)
        ctx.fill()
        ctx.strokeStyle = withAlpha(color, 0.5)
        ctx.lineWidth = 1
        hatch(ctx, pts, gap, angle, seed + 41)
    }

    // ---- Staff (back hand), with a star on top ----
    const staffX = -25
    stroke(() => roughLine(ctx, staffX, 44, staffX - 2, -48, seed + 10, 1.2), "#6b4a2b", 3)
    ctx.fillStyle = withAlpha(look.accent, 0.85)
    starPath(ctx, staffX - 2, -56, 8 + Math.sin(pose.time * 4) * 0.6, seed + 11)
    ctx.fill()
    ctx.strokeStyle = ink
    ctx.lineWidth = 1.4
    ctx.stroke()
    if (pose.active) {
        // Little twinkle marks around the star.
        stroke(() => {
            for (let i = 0; i < 3; i++) {
                const a = pose.time * 2 + (i * Math.PI * 2) / 3
                const r0 = 11
                const r1 = 14 + Math.sin(pose.time * 6 + i) * 1.5
                roughLine(ctx, staffX - 2 + Math.cos(a) * r0, -56 + Math.sin(a) * r0, staffX - 2 + Math.cos(a) * r1, -56 + Math.sin(a) * r1, seed + i, 0.4, 1)
            }
        }, look.accent, 1.4)
    }

    // ---- Back arm ----
    stroke(() => roughLine(ctx, -9, -2, staffX + 2, -22, seed + 12, 0.8))

    // ---- Robe ----
    const robe: Pt[] = [
        [-11, -12],
        [11, -12],
        [16, 8],
        [24, 44],
        [-24, 44],
        [-16, 8],
    ]
    pencilFill(robe, look.tint)
    stroke(() => roughPoly(ctx, robe, seed + 13, 0.9, true))
    // Belt & a fold line
    stroke(() => {
        roughLine(ctx, -14, 10, 14, 10, seed + 14, 0.6, 1)
        roughLine(ctx, 2, 12, 5, 42, seed + 15, 0.8, 1)
    }, ink, 1.3)
    if (look.extra === "cape") {
        const cape: Pt[] = [
            [-12, -10],
            [-30, 30],
            [-26, 46],
            [-18, 20],
        ]
        pencilFill(cape, look.accent, 4, 0.6, 0.25)
        stroke(() => roughPoly(ctx, cape, seed + 16, 0.9, true))
    }

    // ---- Feet ----
    stroke(() => {
        roughEllipse(ctx, -10, 46, 7, 3, seed + 17, 0.6)
        roughEllipse(ctx, 10, 46, 7, 3, seed + 18, 0.6)
    }, ink, 1.4)

    // ---- Hood sits behind the head ----
    const headY = -28
    const headR = 14
    if (look.hat === "hood") {
        const hood: Pt[] = [
            [-17, -6],
            [-20, -30],
            [-8, -50],
            [8, -50],
            [20, -30],
            [17, -6],
        ]
        pencilFill(hood, look.tint, 4, -0.8, 0.4)
        stroke(() => roughPoly(ctx, hood, seed + 19, 0.9, true))
    }

    // ---- Head ----
    ctx.fillStyle = "#fff9ee"
    ctx.beginPath()
    roughEllipse(ctx, 0, headY, headR, headR, seed + 20, 0.9)
    ctx.fill()
    stroke(() => roughEllipse(ctx, 0, headY, headR, headR, seed + 20, 0.9))

    // Face: eyes look toward the opponent. Blink every few seconds.
    const blink = (pose.time + (facing > 0 ? 0 : 1.3)) % 3.7 < 0.12
    const ex = 5
    const ey = headY - 2
    const hit = pose.flash > 0.05 || pose.mood === "sad"
    ctx.fillStyle = ink
    if (hit) {
        // × eyes
        stroke(() => {
            for (const dx of [ex - 3, ex + 4]) {
                roughLine(ctx, dx - 2, ey - 2, dx + 2, ey + 2, seed + 21, 0.3, 1)
                roughLine(ctx, dx + 2, ey - 2, dx - 2, ey + 2, seed + 22, 0.3, 1)
            }
        }, ink, 1.5)
    } else if (blink) {
        stroke(() => {
            roughLine(ctx, ex - 5, ey, ex - 1, ey, seed + 23, 0.2, 1)
            roughLine(ctx, ex + 2, ey, ex + 6, ey, seed + 24, 0.2, 1)
        }, ink, 1.5)
    } else {
        ctx.beginPath()
        ctx.arc(ex - 3, ey, 1.7, 0, Math.PI * 2)
        ctx.arc(ex + 4, ey, 1.7, 0, Math.PI * 2)
        ctx.fill()
        if (pose.cast > 0.3) {
            // Determined eyebrows while casting.
            stroke(() => {
                roughLine(ctx, ex - 6, ey - 5, ex - 1, ey - 3.5, seed + 25, 0.2, 1)
                roughLine(ctx, ex + 1, ey - 3.5, ex + 7, ey - 5.5, seed + 26, 0.2, 1)
            }, ink, 1.4)
        }
    }
    if (look.extra === "glasses") {
        stroke(() => {
            roughEllipse(ctx, ex - 3, ey, 4, 3.5, seed + 27, 0.3)
            roughEllipse(ctx, ex + 4.5, ey, 4, 3.5, seed + 28, 0.3)
            roughLine(ctx, ex + 0.5, ey, ex + 1, ey, seed + 29, 0.2, 1)
        }, ink, 1.1)
    }
    // Mouth
    stroke(() => {
        if (pose.mood === "happy") {
            ctx.moveTo(ex - 4, headY + 5)
            ctx.quadraticCurveTo(ex + 1, headY + 11, ex + 6, headY + 5)
        } else if (hit) {
            roughEllipse(ctx, ex + 1, headY + 7, 2.2, 2.6, seed + 30, 0.2)
        } else if (pose.cast > 0.3) {
            roughEllipse(ctx, ex + 1, headY + 7, 2, 2.4, seed + 30, 0.2)
        } else {
            ctx.moveTo(ex - 2, headY + 6)
            ctx.quadraticCurveTo(ex + 1.5, headY + 8.5, ex + 5, headY + 6)
        }
    }, ink, 1.4)
    // Rosy cheeks
    ctx.fillStyle = withAlpha("#ff7a90", 0.28)
    ctx.beginPath()
    ctx.arc(ex - 8, ey + 5, 2.4, 0, Math.PI * 2)
    ctx.arc(ex + 8, ey + 5, 2.4, 0, Math.PI * 2)
    ctx.fill()

    if (look.extra === "beard") {
        const beard: Pt[] = [
            [-9, headY + 5],
            [-6, headY + 22],
            [0, headY + 28],
            [8, headY + 22],
            [11, headY + 6],
            [4, headY + 12],
            [-4, headY + 12],
        ]
        ctx.fillStyle = "#fff9ee"
        ctx.beginPath()
        roughPoly(ctx, beard, seed + 31, 0.7, true)
        ctx.fill()
        stroke(() => roughPoly(ctx, beard, seed + 31, 0.7, true), ink, 1.4)
        stroke(() => {
            roughLine(ctx, -4, headY + 12, -3, headY + 20, seed + 32, 0.5, 1)
            roughLine(ctx, 3, headY + 12, 3, headY + 21, seed + 33, 0.5, 1)
        }, ink, 1)
    }
    if (look.extra === "scarf") {
        const scarf: Pt[] = [
            [-13, -14],
            [13, -14],
            [12, -8],
            [6, -6],
            [4, 6],
            [-2, 6],
            [-1, -7],
            [-12, -8],
        ]
        pencilFill(scarf, look.accent, 3.5, 0.3, 0.45)
        stroke(() => roughPoly(ctx, scarf, seed + 34, 0.7, true), ink, 1.5)
    }

    // ---- Hats ----
    const brimY = headY - 9
    if (look.hat === "pointed") {
        const cone: Pt[] = [
            [-14, brimY],
            [-6, brimY - 20],
            [2, brimY - 44],
            [14, brimY - 34],
            [12, brimY - 14],
            [16, brimY],
        ]
        pencilFill(cone, look.tint, 4.5, -0.9, 0.4)
        stroke(() => roughPoly(ctx, cone, seed + 35, 1, true))
        stroke(() => roughLine(ctx, -22, brimY + 1, 24, brimY - 1, seed + 36, 1.1), ink, lw / s + 0.6)
        stroke(() => roughLine(ctx, -12, brimY - 5, 15, brimY - 5, seed + 37, 0.5, 1), look.accent, 2.5)
        // A star patch on the hat
        ctx.fillStyle = withAlpha(look.accent, 0.9)
        starPath(ctx, 3, brimY - 20, 4, seed + 38)
        ctx.fill()
    } else if (look.hat === "wide") {
        const crown: Pt[] = [
            [-12, brimY],
            [-10, brimY - 18],
            [-2, brimY - 24],
            [10, brimY - 20],
            [14, brimY],
        ]
        pencilFill(crown, look.tint, 4.5, -0.9, 0.4)
        stroke(() => roughPoly(ctx, crown, seed + 35, 1, true))
        stroke(() => {
            ctx.moveTo(-32, brimY + 3)
            ctx.quadraticCurveTo(0, brimY - 6, 32, brimY + 2)
            ctx.moveTo(-32, brimY + 3)
            ctx.quadraticCurveTo(0, brimY + 8, 32, brimY + 2)
        }, ink, lw / s)
        stroke(() => roughLine(ctx, -11, brimY - 5, 13, brimY - 5, seed + 37, 0.5, 1), look.accent, 2.5)
    } else if (look.hat === "crown") {
        const crown: Pt[] = [
            [-11, brimY + 2],
            [-12, brimY - 14],
            [-5, brimY - 6],
            [1, brimY - 18],
            [7, brimY - 6],
            [14, brimY - 14],
            [13, brimY + 2],
        ]
        pencilFill(crown, look.accent, 3.5, -0.7, 0.55)
        stroke(() => roughPoly(ctx, crown, seed + 35, 0.8, true))
        ctx.fillStyle = withAlpha(look.tint, 0.9)
        for (const px of [-8, 1, 10]) {
            ctx.beginPath()
            ctx.arc(px, brimY - 2, 1.8, 0, Math.PI * 2)
            ctx.fill()
        }
    } else if (look.hat === "hood") {
        // Hood tip
        stroke(() => roughLine(ctx, 0, -50, 10, -62, seed + 39, 0.8), ink, lw / s)
    }

    // ---- Casting arm, toward the opponent ----
    const handX = 15 + pose.cast * 12
    const handY = 2 - pose.cast * 26
    stroke(() => roughLine(ctx, 9, -4, handX, handY, seed + 42, 0.8))
    stroke(() => roughEllipse(ctx, handX + 2, handY, 3.6, 3.2, seed + 43, 0.4), ink, 1.4)
    if (pose.cast > 0.2) {
        // Sparks from the hand
        stroke(() => {
            for (let i = 0; i < 4; i++) {
                const a = -1.2 + i * 0.6 + Math.sin(pose.time * 9 + i) * 0.2
                const r0 = 6
                const r1 = 10 + pose.cast * 5
                roughLine(ctx, handX + 2 + Math.cos(a) * r0, handY + Math.sin(a) * r0, handX + 2 + Math.cos(a) * r1, handY + Math.sin(a) * r1, seed + i + 44, 0.3, 1)
            }
        }, look.accent, 1.5)
    }

    ctx.restore()
}

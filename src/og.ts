// The 1200×630 social card (og:image), drawn with the same pens as the game: a notebook page
// with the title, a Flame's cone-shaped 95% band flying at Harry Plotter, and where 20 shots landed.
// Rendered to public/og.png by scripts/og.ts; open /og.html on the dev server to tweak it.

import { Characters } from "./content/characters"
import { createRng } from "./core/rng"
import { burstPath, hatch, INK, jitter, roughArrow, roughEllipse, roughLine, roughPoly, scribble, starPath, withAlpha, type Pt } from "./render/sketch"
import { drawWizard } from "./render/wizard"

const W = 1200
const H = 630
const FIRE = "#e2492b"
const MARKER = "'Permanent Marker', cursive"
const HAND = "'Caveat', cursive"
const UI = "'Patrick Hand', cursive"

function paper(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#f6f1e2"
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = "rgba(96, 150, 210, 0.2)"
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 23.5; x < W; x += 24) ctx.moveTo(x, 0), ctx.lineTo(x, H)
    for (let y = 23.5; y < H; y += 24) ctx.moveTo(0, y), ctx.lineTo(W, y)
    ctx.stroke()
    ctx.strokeStyle = "rgba(222, 84, 84, 0.5)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(96, 0)
    ctx.lineTo(96, H)
    ctx.stroke()

    // Grain: faint specks, seeded so the card is the same every render.
    const rng = createRng(7)
    for (let i = 0; i < 9000; i++) {
        ctx.fillStyle = `rgba(90, 76, 50, ${0.03 + rng.next() * 0.05})`
        ctx.fillRect(rng.next() * W, rng.next() * H, 1.2, 1.2)
    }

    // Punched holes.
    for (const y of [120, 315, 510]) {
        ctx.fillStyle = "#ddd5c2"
        ctx.beginPath()
        ctx.arc(46, y, 15, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = "rgba(0, 0, 0, 0.08)"
        ctx.beginPath()
        ctx.arc(47, y + 2, 12, 0, Math.PI * 2)
        ctx.fill()
    }
}

function title(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.translate(140, 140)
    ctx.rotate(-0.035)
    ctx.textBaseline = "alphabetic"
    const parts: [string, string, string][] = [
        ["Stats ", `94px ${MARKER}`, INK.pen],
        ["&", `700 98px ${HAND}`, INK.red],
        [" Sorcery", `94px ${MARKER}`, INK.pen],
    ]
    let x = 0
    for (const [text, font, color] of parts) {
        ctx.font = font
        ctx.fillStyle = INK.highlighter
        ctx.fillText(text, x + 5, 5)
        ctx.fillStyle = color
        ctx.fillText(text, x, 0)
        x += ctx.measureText(text).width
    }
    ctx.restore()

    ctx.save()
    ctx.font = `700 40px ${HAND}`
    ctx.fillStyle = INK.pencil
    ctx.fillText("a wizard duelling game to build your statistical intuition", 150, 222)
    // A highlighter swipe under "statistical intuition".
    const before = ctx.measureText("a wizard duelling game to build your ").width
    const hl = ctx.measureText("statistical intuition").width
    ctx.globalCompositeOperation = "multiply"
    ctx.strokeStyle = withAlpha("#ffe96b", 0.8)
    ctx.lineWidth = 16
    ctx.lineCap = "round"
    ctx.beginPath()
    roughLine(ctx, 150 + before, 214, 150 + before + hl, 211, 5, 1.5, 1)
    ctx.stroke()
    ctx.restore()
}

function scene(ctx: CanvasRenderingContext2D) {
    const lx = 230
    const ly = 470
    const rx = 1060
    const ry = 440
    const size = 190
    const x0 = lx + 62
    const y0 = ly - 40
    const x1 = rx - 95
    const y1 = ry - 30

    // The Flame's 95% band: a cone, tight at the staff and about a lane wide at the target.
    const band: Pt[] = [
        [x0, y0 - 6],
        [x1, y1 - 96],
        [x1, y1 + 96],
        [x0, y0 + 6],
    ]
    ctx.save()
    ctx.fillStyle = withAlpha(FIRE, 0.08)
    ctx.beginPath()
    band.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = withAlpha(FIRE, 0.5)
    ctx.lineWidth = 1.3
    hatch(ctx, band, 9, -0.85, 11, 1.2)
    ctx.strokeStyle = withAlpha(FIRE, 0.75)
    ctx.lineWidth = 2
    ctx.beginPath()
    roughLine(ctx, band[0][0], band[0][1], band[1][0], band[1][1], 3, 1.2)
    roughLine(ctx, band[3][0], band[3][1], band[2][0], band[2][1], 4, 1.2)
    ctx.stroke()

    // Where 20 Flames landed: 19 inside the band, one outside, as the band promises.
    const rng = createRng(20)
    const landings: number[] = []
    while (landings.length < 19) {
        const z = rng.normal()
        if (Math.abs(z) < 1.9) landings.push(z)
    }
    landings.push(2.35)
    for (const [i, z] of landings.entries()) {
        const px = x1 + 6 + jitter(3, i) * 6
        const py = y1 + (z / 1.96) * 96
        const outside = Math.abs(z) > 1.96
        ctx.strokeStyle = outside ? INK.red : withAlpha(FIRE, 0.85)
        ctx.lineWidth = outside ? 3 : 2
        ctx.beginPath()
        if (outside) {
            roughEllipse(ctx, px, py, 10, 10, 9, 0.6)
        } else {
            roughLine(ctx, px - 5, py - 5, px + 5, py + 5, i, 0.4, 1)
            roughLine(ctx, px - 5, py + 5, px + 5, py - 5, i + 40, 0.4, 1)
        }
        ctx.stroke()
    }
    ctx.restore()

    // The line that was actually drawn, ending in a hit.
    ctx.save()
    ctx.strokeStyle = FIRE
    ctx.lineWidth = 3
    ctx.setLineDash([14, 10])
    ctx.beginPath()
    roughLine(ctx, x0, y0, x1 + 8, y1 + 14, 8, 1.2, 1)
    ctx.stroke()
    ctx.restore()

    drawWizard(ctx, Characters.apprentice.look, lx, ly, size, 1, { time: 0.3, cast: 1, flash: 0, squash: 0, active: false })
    drawWizard(ctx, Characters.plotter.look, rx, ry, size, -1, { time: 1.1, cast: 0, flash: 0.8, squash: 0.3, active: false })

    // POW!
    ctx.save()
    ctx.translate(x1 + 8, y1 + 14)
    ctx.rotate(-0.12)
    burstPath(ctx, 0, 0, 54, 33, 11, 17)
    ctx.fillStyle = INK.highlighter
    ctx.fill()
    ctx.strokeStyle = INK.red
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = INK.red
    ctx.font = `28px ${MARKER}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("POW!", 0, 2)
    ctx.restore()

    // Pencil annotations.
    ctx.save()
    ctx.fillStyle = INK.pen
    ctx.strokeStyle = INK.pen
    ctx.lineWidth = 2
    ctx.font = `700 34px ${HAND}`
    ctx.textAlign = "center"
    ctx.fillText("95% band", 640, 318)
    roughArrow(ctx, 640, 326, 660, 364, 21, 11)
    ctx.fillStyle = INK.pencil
    ctx.font = `700 30px ${HAND}`
    subscripted(ctx, [["y = β", ""], ["0", "sub"], [" + β", ""], ["1", "sub"], [" · x", ""]], 480, 520)
    ctx.fillStyle = INK.red
    ctx.strokeStyle = INK.red
    ctx.font = `700 28px ${HAND}`
    ctx.textAlign = "left"
    ctx.fillText("1 in 20 lands outside!", 700, 600)
    roughArrow(ctx, 890, 578, x1 - 6, y1 + 2.35 * 49 + 10, 23, 10)
    ctx.restore()
}

/** Caveat has no subscript digits, so draw them smaller and lower by hand. */
function subscripted(ctx: CanvasRenderingContext2D, parts: [string, string][], x: number, y: number) {
    ctx.save()
    ctx.textAlign = "left"
    const base = ctx.font
    for (const [text, kind] of parts) {
        ctx.font = kind === "sub" ? base.replace(/\d+px/, (m) => `${Math.round(parseInt(m) * 0.62)}px`) : base
        ctx.fillText(text, x, kind === "sub" ? y + 7 : y)
        x += ctx.measureText(text).width + (kind === "sub" ? 1 : 0)
    }
    ctx.restore()
}

function sticky(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.translate(985, 52)
    ctx.rotate(0.07)
    ctx.shadowColor = "rgba(80, 60, 20, 0.22)"
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 4
    ctx.fillStyle = "#fff59d"
    ctx.fillRect(0, 0, 170, 150)
    ctx.shadowColor = "transparent"
    ctx.fillStyle = "rgba(225, 225, 215, 0.7)"
    ctx.save()
    ctx.translate(50, -10)
    ctx.rotate(-0.12)
    ctx.fillRect(0, 0, 76, 24)
    ctx.restore()
    ctx.fillStyle = "#3a3320"
    ctx.font = `30px ${UI}`
    const lines = ["Guess.", "Cast.", "Check."]
    lines.forEach((t, i) => ctx.fillText(t, 22, 48 + i * 38))
    ctx.strokeStyle = INK.red
    ctx.lineWidth = 3
    ctx.beginPath()
    roughLine(ctx, 118, 118, 128, 130, 2, 0.5, 1)
    roughLine(ctx, 128, 130, 150, 98, 3, 0.5, 1)
    ctx.stroke()
    ctx.restore()
}

function doodles(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.strokeStyle = INK.pencil
    ctx.lineWidth = 2
    for (const [x, y, r, s] of [
        [880, 290, 14, 1],
        [150, 300, 11, 2],
        [1140, 560, 12, 3],
    ]) {
        starPath(ctx, x, y, r, s)
        ctx.stroke()
    }
    ctx.fillStyle = withAlpha(INK.pen, 0.55)
    ctx.font = `700 26px ${HAND}`
    ctx.fillText("z z z", 1110, 300)
    ctx.strokeStyle = withAlpha(INK.pen, 0.35)
    ctx.lineWidth = 1.4
    scribble(ctx, 128, 590, 12, 4)
    ctx.beginPath()
    roughPoly(
        ctx,
        [
            [470, 262],
            [458, 286],
            [472, 284],
            [462, 308],
        ],
        6,
        0.6,
    )
    ctx.strokeStyle = withAlpha("#8146c8", 0.7)
    ctx.lineWidth = 2.4
    ctx.stroke()
    ctx.restore()
}

async function main() {
    await document.fonts.ready
    await Promise.all([`94px ${MARKER}`, `700 40px ${HAND}`, `26px ${UI}`].map((f) => document.fonts.load(f, "Stats & Sorcery β₀")))
    const ctx = (document.getElementById("og") as HTMLCanvasElement).getContext("2d")!
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    paper(ctx)
    title(ctx)
    doodles(ctx)
    scene(ctx)
    sticky(ctx)
    // scripts/og.ts reads the pixels back out of the DOM, so the PNG is exactly 1200×630.
    const out = document.createElement("pre")
    out.id = "png"
    out.hidden = true
    out.textContent = ctx.canvas.toDataURL("image/png")
    document.body.append(out)
}

main()

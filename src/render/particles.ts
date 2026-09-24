// Particles are tiny pen marks: ticks, little stars and scribbled dots.

import { roughLine, starPath } from "./sketch"

type Shape = "tick" | "star" | "dot"

interface Particle {
    x: number
    y: number
    vx: number
    vy: number
    life: number
    decay: number
    size: number
    color: string
    gravity: number
    shape: Shape
    spin: number
    angle: number
}

export class Particles {
    private items: Particle[] = []

    burst(x: number, y: number, color: string, count = 24, speed = 5, shapes: Shape[] = ["tick", "star", "dot"]) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2
            const v = speed * (0.3 + Math.random() * 0.9)
            this.items.push({
                x,
                y,
                vx: Math.cos(a) * v,
                vy: Math.sin(a) * v,
                life: 1,
                decay: 0.014 + Math.random() * 0.024,
                size: 2.5 + Math.random() * 4,
                color,
                gravity: 0.05,
                shape: shapes[Math.floor(Math.random() * shapes.length)],
                spin: (Math.random() - 0.5) * 0.3,
                angle: a,
            })
        }
    }

    trail(x: number, y: number, color: string, spread = 1.2) {
        this.items.push({
            x: x + (Math.random() - 0.5) * 6,
            y: y + (Math.random() - 0.5) * 6,
            vx: (Math.random() - 0.5) * spread,
            vy: (Math.random() - 0.5) * spread - 0.3,
            life: 1,
            decay: 0.03 + Math.random() * 0.03,
            size: 2 + Math.random() * 3,
            color,
            gravity: -0.01,
            shape: Math.random() < 0.3 ? "star" : "tick",
            spin: (Math.random() - 0.5) * 0.4,
            angle: Math.random() * Math.PI * 2,
        })
    }

    /** Slow confetti stars raining from the top of an area. */
    confetti(x0: number, x1: number, y: number, colors: string[], count = 40) {
        for (let i = 0; i < count; i++) {
            this.items.push({
                x: x0 + Math.random() * (x1 - x0),
                y: y - Math.random() * 80,
                vx: (Math.random() - 0.5) * 1.5,
                vy: 1 + Math.random() * 2,
                life: 1,
                decay: 0.004 + Math.random() * 0.004,
                size: 4 + Math.random() * 6,
                color: colors[Math.floor(Math.random() * colors.length)],
                gravity: 0.02,
                shape: Math.random() < 0.7 ? "star" : "tick",
                spin: (Math.random() - 0.5) * 0.2,
                angle: Math.random() * Math.PI * 2,
            })
        }
    }

    /** `step` is elapsed time in 60 fps frames, so motion is frame-rate independent. */
    update(step: number) {
        const drag = 0.96 ** step
        for (const p of this.items) {
            p.x += p.vx * step
            p.y += p.vy * step
            p.vx *= drag
            p.vy = p.vy * drag + p.gravity * step
            p.life -= p.decay * step
            p.angle += p.spin * step
        }
        this.items = this.items.filter((p) => p.life > 0)
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save()
        ctx.lineCap = "round"
        let i = 0
        for (const p of this.items) {
            ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5))
            ctx.strokeStyle = p.color
            ctx.fillStyle = p.color
            ctx.lineWidth = 1.6
            const size = p.size * (0.4 + p.life * 0.6)
            if (p.shape === "star") {
                starPath(ctx, p.x, p.y, size, i, p.angle)
                ctx.stroke()
            } else if (p.shape === "tick") {
                ctx.beginPath()
                roughLine(ctx, p.x - Math.cos(p.angle) * size, p.y - Math.sin(p.angle) * size, p.x + Math.cos(p.angle) * size, p.y + Math.sin(p.angle) * size, i, 0.4, 1)
                ctx.stroke()
            } else {
                ctx.beginPath()
                ctx.arc(p.x, p.y, size * 0.4, 0, Math.PI * 2)
                ctx.fill()
            }
            i++
        }
        ctx.restore()
    }
}

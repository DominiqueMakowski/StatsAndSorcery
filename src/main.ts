import "./styles/main.css"
import { sfx } from "./audio/sfx"
import { Characters, type Character } from "./content/characters"
import { HP_PER_WIN, newRun, runEnemy, runPlayer, RUN_STAGES, type RunState } from "./content/run"
import { getSpell } from "./content/spells"
import type { Side } from "./core/types"
import { Battlefield } from "./render/battlefield"
import { boilSeed, hatch, INK, roughLine, withAlpha } from "./render/sketch"
import { nextFrame } from "./render/tween"
import { drawWizard } from "./render/wizard"
import { createCard } from "./ui/cards"
import { Coach } from "./ui/coach"
import { RulesNote } from "./ui/rules"
import { DuelView, type DuelSetupView, type DuelStats, type Mode } from "./ui/duelView"

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const titleScreen = $("title-screen")
const duelScreen = $("duel-screen")
const overlay = $("overlay")
const overlayContent = $("overlay-content")

let battlefield: Battlefield | null = null
let duelView: DuelView | null = null
let lastSetup: DuelSetupView | null = null
let run: RunState | null = null
const coach = new Coach($("coach"))
const rules = new RulesNote($("rules"))

// ---------- Screens ----------

function showTitle() {
    duelView?.abort()
    overlay.hidden = true
    duelScreen.hidden = true
    titleScreen.hidden = false
    run = null
    startTitleScene()
}

function startDuel(setup: DuelSetupView) {
    lastSetup = setup
    stopTitleScene()
    titleScreen.hidden = true
    overlay.hidden = true
    duelScreen.hidden = false

    if (!battlefield) battlefield = new Battlefield($("field"), $("field-wrap"))
    if (!duelView) {
        duelView = new DuelView(
            battlefield,
            {
                panels: { left: $("panel-left"), right: $("panel-right") },
                banner: $("turn-banner"),
                hand: $("hand"),
                castBtn: $<HTMLButtonElement>("cast-btn"),
                hint: $("tray-hint"),
                toast: $("toast"),
            },
            coach,
            rules,
            onDuelFinished
        )
    }
    void duelView.start(setup)
}

function showOverlay(html: string): HTMLElement {
    overlayContent.innerHTML = html
    overlay.hidden = false
    return overlayContent
}

function setupFor(mode: Mode): DuelSetupView {
    if (mode === "pve") return { mode, left: Characters.apprentice, right: Characters.plotter }
    return {
        mode,
        left: { ...Characters.apprentice, name: "Player 1" },
        right: {
            ...Characters.apprentice,
            id: "apprentice-2",
            name: "Player 2",
            look: { ink: "#3a1a1a", tint: "#e0705a", accent: "#7bd389", hat: "pointed", extra: "cape" },
        },
    }
}

// ---------- The run: three duels, a new spell after each ----------

function startRun() {
    run = newRun()
    showIntro()
}

function showIntro() {
    if (!run) return
    const enemy = runEnemy(run)
    const el = showOverlay(`
        <div class="note note-intro">
            <p class="note-kicker">duel ${run.index + 1} of ${RUN_STAGES.length}</p>
            <canvas class="portrait" width="150" height="170" aria-hidden="true"></canvas>
            <h2>${enemy.name}</h2>
            <p class="note-title">${enemy.title}</p>
            <p>${enemy.intro ?? ""}</p>
            <p class="note-lesson">${enemy.lesson ?? ""}</p>
            <div class="overlay-actions">
                <button class="btn btn-primary" id="intro-go">Duel!</button>
                <button class="btn btn-quiet" id="intro-quit">Back to the notebook</button>
            </div>
        </div>`)
    livePortrait(el.querySelector<HTMLCanvasElement>(".portrait")!, enemy, -1)
    el.querySelector<HTMLButtonElement>("#intro-go")!.onclick = () => {
        sfx.play("pop")
        startDuel({ mode: "pve", left: runPlayer(run!), right: enemy })
    }
    el.querySelector<HTMLButtonElement>("#intro-quit")!.onclick = showTitle
}

function showReward() {
    if (!run) return
    const choices = RUN_STAGES[run.index].rewards
    const el = showOverlay(`
        <div class="note note-reward">
            <h2>Your spellbook grows</h2>
            <p>Pick a new card. You also feel tougher: <b class="red">+${HP_PER_WIN} ♥</b></p>
            <div class="reward-cards"></div>
            <div class="overlay-actions"><button class="btn btn-quiet" id="reward-skip">Skip</button></div>
        </div>`)
    const holder = el.querySelector<HTMLElement>(".reward-cards")!
    const next = (spellId?: string) => {
        if (spellId) run!.deck.push(spellId)
        run!.maxHp += HP_PER_WIN
        run!.index++
        sfx.play("scribble")
        showIntro()
    }
    for (const id of choices) {
        const card = createCard(getSpell(id), { affordable: true, onPlay: () => next(id) })
        card.classList.add("is-choice")
        holder.appendChild(card)
    }
    el.querySelector<HTMLButtonElement>("#reward-skip")!.onclick = () => next()
}

function onDuelFinished(winner: Side, setup: DuelSetupView, stats: DuelStats) {
    if (run) {
        run.stats.shots += stats.shots
        run.stats.hits += stats.hits
        run.stats.expectedHits += stats.expectedHits
        run.stats.outliers += stats.outliers
        run.stats.turns += stats.turns
        if (winner !== "left") return showRunDefeat(setup)
        if (run.index >= RUN_STAGES.length - 1) return showRunVictory()
        return showDuelWon(setup, stats)
    }
    showResult(winner, setup, stats)
}

function statsBlock(stats: DuelStats, title = "your shots"): string {
    if (stats.shots === 0) return ""
    const accuracy = Math.round((100 * stats.hits) / stats.shots)
    return `
        <div class="stat-block">
            <p class="stat-title">${title}</p>
            <div class="stat-row"><span>fired</span><b>${stats.shots}</b></div>
            <div class="stat-row"><span>landed</span><b>${stats.hits} (${accuracy}%)</b></div>
            <div class="stat-row"><span>the odds said</span><b>≈ ${stats.expectedHits.toFixed(1)}</b></div>
            <div class="stat-row"><span>outside the 95% band</span><b>${stats.outliers}</b></div>
        </div>`
}

function showDuelWon(setup: DuelSetupView, stats: DuelStats) {
    const el = showOverlay(`
        <div class="scroll">
            <h1>Victory!</h1>
            <p>${setup.right.name} yields. Your lines ran true.</p>
            ${statsBlock(stats)}
            <div class="overlay-actions"><button class="btn btn-primary" id="next-btn">Choose a new card →</button></div>
        </div>`)
    el.querySelector<HTMLButtonElement>("#next-btn")!.onclick = showReward
}

function showRunDefeat(setup: DuelSetupView) {
    const el = showOverlay(`
        <div class="scroll scroll-defeat">
            <h1>Defeat…</h1>
            <p>${setup.right.name} got lucky. Or did they? Read the bands, and try again.</p>
            <div class="overlay-actions">
                <button class="btn btn-primary" id="retry-btn">Retry this duel</button>
                <button class="btn" id="restart-btn">New run</button>
                <button class="btn btn-quiet" id="menu-btn">Notebook</button>
            </div>
        </div>`)
    el.querySelector<HTMLButtonElement>("#retry-btn")!.onclick = showIntro
    el.querySelector<HTMLButtonElement>("#restart-btn")!.onclick = startRun
    el.querySelector<HTMLButtonElement>("#menu-btn")!.onclick = showTitle
}

function showRunVictory() {
    const s = run!.stats
    const el = showOverlay(`
        <div class="scroll scroll-final">
            <h1>Run complete!</h1>
            <p>Harry Plotter, Lin and the Outlier, all beaten.</p>
            ${statsBlock(s, "the whole run")}
            <p class="fine">Over many shots, "landed" drifts toward what "the odds said". That's the whole trick.</p>
            <div class="overlay-actions">
                <button class="btn btn-primary" id="restart-btn">Another run</button>
                <button class="btn btn-quiet" id="menu-btn">Notebook</button>
            </div>
        </div>`)
    el.querySelector<HTMLButtonElement>("#restart-btn")!.onclick = startRun
    el.querySelector<HTMLButtonElement>("#menu-btn")!.onclick = showTitle
}

function showResult(winner: Side, setup: DuelSetupView, stats: DuelStats) {
    let title: string
    let text: string
    if (setup.mode === "pve") {
        title = winner === "left" ? "Victory!" : "Defeat…"
        text = winner === "left" ? `${setup.right.name} yields. Your lines ran true.` : `${setup.right.name} got lucky… or did they? Try reading the bands.`
    } else {
        title = `${setup[winner].name} wins!`
        text = "A duel of well-aimed lines."
    }
    const el = showOverlay(`
        <div class="scroll${winner !== "left" && setup.mode === "pve" ? " scroll-defeat" : ""}">
            <h1>${title}</h1>
            <p>${text}</p>
            ${setup.mode === "pve" ? statsBlock(stats) : ""}
            <div class="overlay-actions">
                <button class="btn btn-primary" id="again-btn">Duel again</button>
                <button class="btn btn-quiet" id="menu-btn">Notebook</button>
            </div>
        </div>`)
    el.querySelector<HTMLButtonElement>("#again-btn")!.onclick = () => lastSetup && startDuel(lastSetup)
    el.querySelector<HTMLButtonElement>("#menu-btn")!.onclick = showTitle
}

// ---------- Doodle portraits & the title scene ----------

const portraits: { canvas: HTMLCanvasElement; character: Character; facing: 1 | -1 }[] = []

function livePortrait(canvas: HTMLCanvasElement, character: Character, facing: 1 | -1) {
    portraits.push({ canvas, character, facing })
}

function drawPortraits(time: number) {
    for (let i = portraits.length - 1; i >= 0; i--) {
        const p = portraits[i]
        if (!p.canvas.isConnected) {
            portraits.splice(i, 1)
            continue
        }
        const ctx = p.canvas.getContext("2d")!
        ctx.clearRect(0, 0, p.canvas.width, p.canvas.height)
        drawWizard(ctx, p.character.look, p.canvas.width / 2, p.canvas.height * 0.56, p.canvas.height * 0.62, p.facing, {
            time,
            cast: 0,
            flash: 0,
            squash: 0,
            active: false,
        })
    }
}

let titleRunning = false
const titleCanvas = $<HTMLCanvasElement>("title-canvas")

function startTitleScene() {
    if (titleRunning) return
    titleRunning = true
    const ctx = titleCanvas.getContext("2d")!
    const frame = (now: number) => {
        if (!titleRunning) return
        const time = now / 1000
        const dpr = window.devicePixelRatio || 1
        const w = titleCanvas.clientWidth
        const h = titleCanvas.clientHeight
        if (titleCanvas.width !== Math.round(w * dpr)) {
            titleCanvas.width = Math.round(w * dpr)
            titleCanvas.height = Math.round(h * dpr)
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w, h)

        const seed = boilSeed(time, 6)
        const lx = w * 0.16
        const rx = w * 0.84
        const y = h * 0.62
        const wiggle = Math.sin(time * 0.8) * h * 0.12
        // A band and a dashed line between the two, with the far end wandering.
        const band: [number, number][] = [
            [lx + 40, y - 6],
            [rx - 40, y + wiggle - h * 0.2],
            [rx - 40, y + wiggle + h * 0.2],
            [lx + 40, y + 6],
        ]
        ctx.save()
        ctx.fillStyle = withAlpha("#e2492b", 0.07)
        ctx.beginPath()
        band.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = withAlpha("#e2492b", 0.45)
        ctx.lineWidth = 1
        hatch(ctx, band, 7, -0.85, seed, 1)
        ctx.strokeStyle = "#e2492b"
        ctx.lineWidth = 2.2
        ctx.setLineDash([12, 9])
        ctx.lineDashOffset = -time * 40
        ctx.beginPath()
        roughLine(ctx, lx + 40, y, rx - 40, y + wiggle, seed, 1.2, 1)
        ctx.stroke()
        ctx.restore()

        drawWizard(ctx, Characters.apprentice.look, lx, y + 4, h * 0.58, 1, { time, cast: 0.6 + Math.sin(time * 2) * 0.2, flash: 0, squash: 0, active: false })
        drawWizard(ctx, Characters.plotter.look, rx, y + 4 + wiggle, h * 0.58, -1, { time, cast: 0, flash: 0, squash: 0, active: false })
        ctx.fillStyle = INK.pencil
        ctx.font = "700 16px 'Caveat', cursive"
        ctx.textAlign = "center"
        ctx.fillText("y = β₀ + β₁·x", w / 2, y - h * 0.32)
        nextFrame(frame)
    }
    nextFrame(frame)
}

function stopTitleScene() {
    titleRunning = false
}

;(function portraitLoop(now: number) {
    drawPortraits(now / 1000)
    nextFrame(portraitLoop)
})(0)

// ---------- Wiring ----------

for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
    btn.onclick = () => {
        sfx.play("pop")
        const mode = btn.dataset.mode
        if (mode === "run") startRun()
        else startDuel(setupFor(mode as Mode))
    }
}

const muteBtn = $<HTMLButtonElement>("mute-btn")
const renderMute = () => (muteBtn.textContent = sfx.muted ? "♪ sound off" : "♪ sound on")
muteBtn.onclick = () => {
    sfx.toggle()
    renderMute()
}
renderMute()

$("quit-btn").onclick = showTitle
$("rules-btn").onclick = () => duelView?.showRules()
$("tips-reset").onclick = (e) => {
    e.preventDefault()
    coach.reset()
    sfx.play("pop")
    ;(e.currentTarget as HTMLElement).textContent = "tips will show again ✓"
}

showTitle()

// Dev shortcuts: ?duel=lin jumps straight into a quick duel against that opponent, and
// window.__sas exposes the running duel for scripts.
const wanted = new URLSearchParams(location.search).get("duel")
if (wanted && Characters[wanted]) startDuel({ mode: "pve", left: Characters.apprentice, right: Characters[wanted] })
if (import.meta.env.DEV) {
    Object.assign(window, {
        __sas: {
            get duel() {
                return duelView?.current
            },
            get run() {
                return run
            },
        },
    })
}

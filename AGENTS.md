# AGENTS.md — orientation for anyone (human or AI) working on Stats & Sorcery

## Intent

Stats & Sorcery is an **educational duelling card game that builds intuition for statistics**, aimed at students who find the topic dry. Every attack spell is a linear model `y = β₀ + β₁·x`; the player learns what intercept, slope, spread and a 95% interval *feel* like by aiming spells. The lesson and the game mechanic are the same thing: the shaded band is the true confidence band, the hit chance is the true probability, and about one shot in twenty really does land outside the band.

Design priorities, in order:

1. **Honest statistics.** Never fake randomness or fudge odds for drama. The displayed hit chance must equal the real probability; the band must be the true 95% interval. If a mechanic can't be explained in one plain sentence about lines and uncertainty, it probably doesn't belong.
2. **Fun first, lecture never.** Teaching happens through play, contextual sticky notes and short opponent intros, not walls of text. A tip is one or two sentences.
3. **Sleek and juicy.** One duel should feel finished: live aim preview, hit-stop, bursts, sound, keyboard play, no dead time.
4. **Small, dependency-light, hackable.** Plain Vite + TypeScript, no framework, no image assets: everything is drawn in code.

## Art direction: the bored student's notebook

The whole game is a page in the notebook of a bored but talented student doodling wizard duels during a dull class. Keep every new visual inside this world.

- **Surface**: cream squared paper (`--paper`), light-blue grid, red margin line, punched holes, subtle grain. Cards are index cards with tape, slightly tilted. Results come on scrolls, tips on yellow sticky notes.
- **Tools**: ballpoint blue ink (`--ink`, `#1e2a5a`) for outlines; pencil grey for guides and idle marginalia; red pen for damage, targets and corrections; yellow highlighter for emphasis. Spell families are coloured pens (`ELEMENT_COLORS` in `src/render/battlefield.ts`, CSS `--fire`, `--frost`, …).
- **Lines wobble.** Use the primitives in `src/render/sketch.ts` (`roughLine`, `roughPoly`, `roughEllipse`, `hatch`, `scribble`, `burstPath`, `starPath`, `cloudPath`) rather than straight canvas calls. Pass a seed from `boilSeed(time)` so shapes "boil" like hand-drawn animation; use a fixed seed for things that shouldn't jitter (ruler-drawn axes).
- **Fills are pencil, not flat.** Bands are hatching; robes are a low-alpha tint plus hatch lines; blobs are scribbles. Avoid glows, gradients, blur and neon.
- **Characters are cute doodles**: big round head, dot eyes, rosy cheeks, tiny body, a hat and a staff. Personality comes from small extras (beard, glasses, cape, scarf) and expressions (blink, casting eyebrows, × eyes when hit, happy/sad at the end). See `src/render/wizard.ts`.
- **Text is handwritten**: Permanent Marker for titles and names, Patrick Hand for UI, Caveat for annotations and numbers. Prefer ½ and ¼ over 0.5 and 0.25 in labels.
- **Juice is comic-book**: "POW!/BAM!" bursts, "whiff~", "CLANK", page shake, scribbled-out hearts, confetti stars. Sounds are synthesised pencil scratches, whooshes and pops (`src/audio/sfx.ts`), never sample files.
- **CSS tricks in use**: mismatched border radii for hand-drawn boxes (`--hand-radius`), SVG feTurbulence for paper grain (`--paper-noise`), a `--tilt` per card.

If you add UI, ask: "would this be on the page, drawn with these pens?" A modal with a drop shadow and rounded corners is not; a taped-on note is.

## Architecture map

```
src/core/      pure rules, no DOM, fully tested
  stats.ts       normal CDF, 95% z, heightAt(line, x): the maths behind the bands
  shot.ts        field geometry (5 lanes at ½ steps, hitbox ±0.18), attackLine, resolveShot, hitChance
  duel.ts        the Duel state machine: hands, AP, wards, hexes; emits DuelEvent[]; previewPlan()
  ai.ts          enumerates every legal play sequence, scores expected damage, softmax by "sloppiness"
  rng.ts         seeded Mulberry32 + Box–Muller; duels and tests are reproducible
  types.ts       Spell kinds (attack | modifier | move | ward | hex), Card, Play, DuelEvent
src/content/   data only
  spells.ts      every spell; enemyOnly ones are never offered as rewards
  characters.ts  apprentice + 3 opponents, each with a look, sloppiness, intro and lesson
  run.ts         the 3-duel run, reward pool, +1 ♥ per win, run statistics
src/render/    canvas
  sketch.ts      hand-drawn primitives and the INK palette
  wizard.ts      the doodle wizard
  battlefield.ts axes, bands, previews, shots, wards, bursts, floats, impact marks, marginalia
  particles.ts   pen-mark particles (ticks, stars, dots) and confetti
  tween.ts       animate(), wait(), reducedMotion(), nextFrame() (rAF with a timer fallback)
src/ui/        DOM
  duelView.ts    turn flow, queueing, hover previews, hotkeys, AI playback, coaching triggers, stats
  cards.ts       card markup and the sketchy SVG mini-graph on each card
  hud.ts         name strips, hearts, stars, "jinxed" chip
  coach.ts       Professor Hoot's once-only sticky notes (persisted in localStorage)
src/audio/sfx.ts  WebAudio synth; mute persisted in localStorage
src/main.ts    screens: title, run intro → duel → reward → …, result scrolls, portraits, dev hooks
src/styles/main.css  the whole notebook look; CSS variables at the top
```

**Flow of a turn.** `Duel` resolves everything instantly and returns events; `DuelView.run()` replays them through `Battlefield.play()` as animations. The core never touches the DOM or the canvas; the UI never rolls dice. Keep it that way.

**Coordinate frames.** Each wizard casts in its own frame: `x` is distance travelled (0 at the caster, 1 at the target), `y` is relative to the caster's lane. `toWorldX`/`toLocalX` in `shot.ts` convert. The right-hand wizard's frame is mirrored.

**Queue semantics.** Modifiers and moves queued after an attack slot in *before* it (`DuelView.withPlay`), so "Firebolt, then Shift" means "shift the Firebolt". Modifiers with no attack after them are wasted; the AI is penalised for that and the hint text warns the player.

## Balance notes

- Lanes are ½ apart, hitbox is ±0.18, so a spread (σ at the target) around 0.1 is reliable and around 0.3 is a gamble. Firebolt aligned ≈ 94%; Chain Lightning aligned ≈ 54% for 2 damage.
- Apprentice: 5 HP, 2 AP, hand of 3. Run: +1 ♥ and one new spell per win, full heal between duels.
- Wendel teaches intercept (he dodges), Lin teaches slope (walls at mid-field force arcs), the Outlier teaches variance (jinx doubles your spread). New opponents should teach one idea each.
- Cost-0 cards (Ember, Nudge) exist to make reward choices interesting; watch that they don't dominate.

## Conventions

- TypeScript, strict, `noUnusedLocals`. Formatting: 4-space indent, no semicolons, double quotes, ~160-column lines (the code is Prettier-shaped; keep it consistent by hand, there's no formatter config yet).
- Comments explain *why* or the maths, not what the next line does. Short file-header comments say what a module is for.
- Names: `Side` is `"left" | "right"`; `β₀/β₁` are `beta0/beta1`; `sd` is a standard deviation; `sdScale` multiplies it.
- No new runtime dependencies without a strong reason. Fonts come from Google Fonts (see `index.html`).
- Reduced motion must keep working: use `animate()`/`wait()` from `tween.ts`, which clamp durations.
- Anything the player sees should read as handwriting on paper; anything the core computes should be exact.

## Commands

```sh
bun install
bun run dev        # Vite dev server (honours $PORT; .claude/launch.json uses autoPort)
bun test           # core rules + statistics tests (Monte Carlo vs analytic hit chance, band coverage)
bun run typecheck  # tsc --noEmit
bun run build      # tsc && vite build → dist/ (relative base, works on GitHub Pages)
```

**Deployment:** two workflows publish to the `gh-pages` branch (Pages source: "Deploy from a branch", `gh-pages`, root). `pages.yml` builds every push to `main` into the branch root, cleaning stale files but keeping `pr-preview/`. `pr-preview.yml` builds every pull request into `pr-preview/pr-<n>/` and comments the link on the PR, so main and PR versions are live at the same time. Both work because Vite's `base` is `./` (relative): keep it that way. Never commit `dist/`; it is gitignored. Never edit the `gh-pages` branch by hand.

**Running it:** the root `index.html` loads `/src/main.ts` and only works through Vite. Opening the file directly, or serving the repo root with a plain static server, gives a blank page. Use `bun run dev`, or build and serve `dist/`.

## Testing and debugging tips

- Put rules and maths in `src/core` and cover them in `*.test.ts`; UI and rendering are verified by playing.
- `?duel=wendel|lin|outlier` on the dev server jumps straight into a quick duel against that opponent.
- In dev, `window.__sas.duel` is the live `Duel` and `window.__sas.run` the run state. Modules can be imported in the browser console with `await import('/src/core/ai.ts')` to script turns (e.g. call `planTurn(duel, "left", 0, rng)` and click the matching `#hand .card[data-uid]`).
- Tips are remembered in `localStorage` (`sas.tips`); use "show tips again" on the title page or clear the key.
- If the canvas looks frozen in an embedded browser, check whether `requestAnimationFrame` is firing before suspecting the renderer; `nextFrame()` falls back to a 250 ms timer.
- Screenshots to compare against: the title page (two wizards and a wandering band), a duel with a queued Firebolt (hatched band, red target brackets, highlighted hit chance), a "BAM!" hit, the victory scroll with the shot statistics, the reward note with three cards.

## Roadmap (what's next)

See `docs/PLAN.md` for the full plan. Open items: the Grimoire (short plain-language pages unlocked per lesson), a local save for runs, a settings screen, then online play. Deferred by design: charge-to-cast spells, skill trees, cosmetics.

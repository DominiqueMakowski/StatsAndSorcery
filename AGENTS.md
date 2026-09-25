# AGENTS.md — orientation for anyone (human or AI) working on Stats & Sorcery

## Intent

Stats & Sorcery is a **wizard duelling game that builds statistical intuition**, aimed at students who find the topic dry. Players learn what spread, a 95% interval, a probability or a distribution *feel* like by aiming spells, not by reading formulas. The lesson and the mechanic are the same thing: today every spell is a noisy line `y = β₀ + β₁·x`, the hatched band is its true 95% interval, and about one shot in twenty really does land outside it.

Design priorities, in order:

1. **Honest statistics.** Never fake randomness or fudge odds for drama. The band must be the true 95% interval, and any odds the game reveals must be the real probability. If a mechanic can't be explained in one plain sentence about uncertainty, it probably doesn't belong.
2. **Fun first, lecture never.** Teaching happens through play, contextual sticky notes and one-line opponent intros, not walls of text. A tip is one or two short sentences.
3. **Sleek and juicy.** One duel should feel finished: live aim preview, hit-stop, bursts, sound, keyboard play, no dead time.
4. **Small, dependency-light, hackable.** Plain Vite + TypeScript, no framework, no image assets: everything is drawn in code.

## Design direction

**Show the uncertainty, not the answer.** The game never shows a hit chance while you aim: reading the odds off the band is the intuition we want players to build. Exact odds appear only afterwards, as feedback to check that intuition against (Hoot's "missed at 90%?" note, "the odds said" on the result scroll). Don't add aiming aids that do the judging for the player.

**Nail the basics first.** The first duel gives the player exactly two cards: **Flame**, a spell (1 damage, average precision), and **Move**, an action (one lane up or down). Everything else is earned during the run, one idea per opponent. Don't add a card unless it teaches something the existing ones don't.

Cards come in three categories:

- **Spells** (`kind: "attack"`) are distributions over where a shot lands, and each one is a trade-off: precise (narrow band) but weak or costly, or powerful but wild. A new spell should sit at a new point on that trade-off, not just be better.
- **Actions** (`kind: "move"`) change the situation rather than the spell. Move is the only one for now.
- **Alterations** (`kind: "alteration"`) change the parameters of your next spell. Shift (β₀), Tilt (β₁), Arc and Focus (σ ÷ 2) exist in basic form and are unlocked after the first duel. Next to explore: curvature (a β₂·x² term, so spells can bend) and other tweaks to the distribution.

Wards and hexes are opponent tricks for now (Lin's walls, the Outlier's Jinx).

**Beyond lines.** Spells don't have to stay linear models. Future spells can draw on other statistical ideas, as long as each fits in one plain sentence and its odds stay exact. For example **Fire Rain**, an area-of-effect spell that falls at a point drawn from a Normal distribution with a given location and SD and hits everything within a radius: it teaches location vs. scale. Skewed, heavy-tailed or bimodal spells could follow. Where there's no closed form, estimate the hit chance by Monte Carlo with common random numbers, as `hitChance` in `shot.ts` already does with wards.

**Funny names with a statistical twist.** Characters, items and places should ideally be puns on popular wizard references (Harry Potter, Tolkien, Merlin…) that allude to a stats concept, e.g. *Lord Voldemode*, *Tom Residdle*, *The Wizard of Odds*, *Logwarts School of Statcraft*. Keep them affectionate puns rather than the originals, and ideally let the name hint at what the opponent teaches. Draw from the approved list in [`docs/names.md`](docs/names.md), which also has story ideas (quest goals, items, places). The current names (Wobbly Wendel, Warden Lin) are placeholders; The Outlier is the right spirit.

**Parked ideas** (from the original brainstorm): items (e.g. a hat granting +1 ★), charge-to-cast alterations, character archetypes (spellcaster vs. archer), cosmetics that evolve with progress, skill trees, online play and classroom tournaments.

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
  types.ts       card kinds (attack | alteration | move | ward | hex), Card, Play, DuelEvent
src/content/   data only
  spells.ts      every card; enemyOnly ones are never offered to the player
  characters.ts  apprentice + 3 opponents, each with a look, sloppiness, intro and lesson
  run.ts         the 3-duel run: the cards each win offers, +1 ♥ per win, run statistics
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

**Queue semantics.** Alterations and moves queued after a spell slot in *before* it (`DuelView.withPlay`), so "Flame, then Shift" means "shift the Flame". Alterations with no spell after them are wasted; the AI is penalised for that and the hint text warns the player.

## Balance notes

- Lanes are ½ apart and the hitbox is ±0.18, so a spread (σ at the target) around 0.1 is reliable and around 0.3 is a gamble. Aligned hit chances (internal, never shown while aiming): Flame 83%, Frost Ray ≈ 100% for 2 ★, Chain Lightning 54% for 2 damage. A jinxed Flame drops to 51%; a focused one rises to 99%.
- Flame has a precise start (β₀ σ 0.01) but a wobbly angle (β₁ σ 0.13), so its band is a cone: ±0.02 at the staff, ±0.13 at mid-field, ±0.26 at the target. It's the first picture of "uncertainty grows with distance".
- Apprentice: 5 HP, 2 ★, hand of 3, deck of 4 Flame + 3 Move. Each win gives +1 ♥ and one card from that stage's `rewards` in `run.ts`; full heal between duels.
- One idea per opponent. Wendel (Flame + Move only, dodges) teaches reading the band. Lin (walls at mid-field) teaches slope vs. intercept: Tilt runs into a wall, Shift clears it, Arc lobs over when you're aligned (82% with Flame). The Outlier (Jinx doubles your spread) teaches variance: Focus, or a sure 1 over a risky 2.
- With 2 ★, a spell plus two alterations doesn't fit in one turn; that's why Arc is a single card.
- Damage is an integer and Flame already deals the minimum, so "precise but weak" can only mean "precise but costly" (Frost Ray) for now. A finer HP/damage scale would open up that axis.

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

**Deployment:** two workflows publish to the `gh-pages` branch (Pages source: "Deploy from a branch", `gh-pages`, root). `pages.yml` builds every push to `main` into the branch root, cleaning stale files but keeping `pr-preview/`. `pr-preview.yml` builds every pull request into `pr-preview/pr-<n>/` and comments the link on the PR. Both work because Vite's `base` is `./` (relative): keep it that way. Never commit `dist/`; it is gitignored. Never edit the `gh-pages` branch by hand.

**Running it:** the root `index.html` loads `/src/main.ts` and only works through Vite. Opening the file directly, or serving the repo root with a plain static server, gives a blank page. Use `bun run dev`, or build and serve `dist/`.

## Testing and debugging tips

- Put rules and maths in `src/core` and cover them in `*.test.ts`; UI and rendering are verified by playing.
- `?duel=wendel|lin|outlier` on the dev server jumps straight into a quick duel against that opponent.
- In dev, `window.__sas.duel` is the live `Duel` and `window.__sas.run` the run state. Modules can be imported in the browser console with `await import('/src/core/ai.ts')` to script turns (e.g. call `planTurn(duel, "left", 0, rng)` and click the matching `#hand .card[data-uid]`).
- Tips are remembered in `localStorage` (`sas.tips`); use "show tips again" on the title page or clear the key.
- If the canvas looks frozen in an embedded browser, check whether `requestAnimationFrame` is firing before suspecting the renderer; `nextFrame()` falls back to a 250 ms timer.

## Roadmap

Open: the Grimoire (short plain-language pages unlocked per lesson), a local save for runs, a settings screen (including a "show odds" toggle), then new cards and opponents following the design direction above.

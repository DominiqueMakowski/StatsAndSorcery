# AGENTS.md — orientation for anyone (human or AI) working on Stats & Sorcery

## Intent

Stats & Sorcery is a **wizard duelling game that builds statistical intuition**, aimed at students who find the topic dry. Players learn what spread, a 95% interval, a probability or a distribution *feel* like by aiming spells, not by reading formulas. The lesson and the mechanic are the same thing: today every spell is a noisy line `y = β₀ + β₁·x`, the hatched band is its true 95% interval, and about one shot in twenty really does land outside it.

Design priorities, in order:

1. **Honest statistics.** Never fake randomness or fudge odds for drama. The band must be the true 95% interval, and any odds the game reveals must be the real probability. If a mechanic can't be explained in one plain sentence about uncertainty, it probably doesn't belong.
2. **Fun first, lecture never.** Teaching happens through play, contextual sticky notes and one-line opponent intros, not walls of text. A tip is one or two short sentences.
3. **Sleek and juicy.** One duel should feel finished: a dramatic reveal of each spell's band, hit-stop, bursts, sound, no dead time. Mouse-first: keep keyboard instructions off the page (the number keys, Enter and Esc still work, unadvertised).
4. **Small, dependency-light, hackable.** Plain Vite + TypeScript, no framework, no image assets: everything is drawn in code.

## Learning mechanism

The game teaches by **predict → act → observe → compare**, the loop that builds calibrated intuition:

1. **Predict.** While planning you see only the parameters: the card (its spread, sketched and as "95% band ±…"), the alterations you've queued (β₀ +2, β₁ −2…), the axis labels in your own frame, the target's hitbox brackets and the mirrors. There is **no aim preview** (no band, no path) and **no hit chance**. You have to picture where the spell will go and how likely it is to land.
2. **Act.** Cast it (or move, or pass).
3. **Observe.** When the spell flies, its true 95% band blooms from your staff, hangs for a moment, then collapses onto the line that was actually drawn. Right or wrong, you can see why.
4. **Compare.** Exact odds appear only afterwards, as feedback to check your intuition against: Hoot's "missed at 90%?" note, and "landed" vs. "the odds said" on the result scroll.

Don't add aiming aids that do the judging for the player. What stays visible is the *situation* (positions, hitboxes, where a Move will leave you), never the *answer*. For debugging or demos, `?aim` in the URL brings the planning preview back.

## Design direction

**Nail the basics first.** The first duel gives the player exactly two actions: **Flame**, a spell (1 damage, average precision), and **Move**, a movement (one lane up or down). Everything else is earned during the run, one idea per opponent. Don't add an action unless it teaches something the existing ones don't.

**Vocabulary.** Keep these words consistent in the code, the UI and the docs:

- A **card** shows one **action** (`Action` in code). Every action costs **action points**, drawn as ★ (`cost`; a character's per-turn budget is `ap`), and has a **type** (`kind`):
  - **Spells** (`"spell"`) are distributions over where a shot lands, and each one is a trade-off: precise (narrow band) but weak or costly, or powerful but wild. A new spell should sit at a new point on that trade-off, not just be better.
  - **Movements** (`"movement"`) change where you stand rather than the spell. Move is the only one for now.
  - **Alterations** (`"alteration"`) change one parameter of your next spell, and are named with the statistical term so players pick up the vocabulary: **Intercept** (β₀, ±2), **Slope** (β₁, ±2), **SD ÷ 2** (σ). Their ± buttons show the actual change (+2, −2: two lanes). They're unlocked after the first duel. Arc (β₀ +2 and β₁ −2 at once) exists but is out of the run for now, to keep things simple. Next to explore: curvature (a β₂·x² term, so spells can bend) and other tweaks to the distribution.
  - Wards and hexes (`"ward"`, `"hex"`) are opponent tricks for now (Draco's walls, Voldemode's Jinx).
- Your **spellbook** is your deck: each turn you draw a hand of action cards from it.
- The **Grimoire** is the book of every action you know (not built yet, see below).

**Grimoire → spellbook → hand.** The plan: every action a player unlocks goes into their Grimoire, the big book of all known actions, each with a short plain-language page on what it does to the distribution. Before a duel, they pick N of them to form their spellbook, and each turn's hand is drawn from that. Players shape what *can* be drawn without controlling what *will* be: they manage odds, not outcomes, which is the game's lesson again (a deck is a distribution; drawing a hand is sampling without replacement). For now there's no Grimoire screen: each win adds its reward straight to the spellbook.

**Mirrors.** The top and bottom edges of the field are mirrors (at ±4, a lane beyond the outer lanes): spells bounce off them, so a line aimed past the edge comes back in, and a wide band hugging an edge folds back on itself. Statistically the landing point is a *folded normal*: `foldedIntervalProb` in `stats.ts` sums the normal over every mirror image of the target, so hit chances stay exact, and the drawn band is the unfolded band plus its reflections. Bank shots are modest with ±2 slopes; bigger slope alterations would make them a real tactic.

**Beyond lines.** Spells don't have to stay linear models. Future spells can draw on other statistical ideas, as long as each fits in one plain sentence and its odds stay exact. For example **Fire Rain**, an area-of-effect spell that falls at a point drawn from a Normal distribution with a given location and SD and hits everything within a radius: it teaches location vs. scale. Skewed, heavy-tailed or bimodal spells could follow. Where there's no closed form, estimate the hit chance by Monte Carlo with common random numbers, as `hitChance` in `shot.ts` already does with wards.

**Funny names with a statistical twist.** Characters, items and places should ideally be puns on popular wizard references (Harry Potter, Tolkien, Merlin…) that allude to a stats concept, e.g. *Lord Voldemode*, *Tom Residdle*, *The Wizard of Odds*, *Logwarts School of Statcraft*. Keep them affectionate puns rather than the originals, and ideally let the name hint at what the opponent teaches. Draw from the approved list in [`docs/names.md`](docs/names.md), which also has story ideas (quest goals, items, places). The run's opponents are Harry Plotter, Draco Malfit and Lord Voldemode.

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
  shot.ts        field geometry (7 whole-number lanes −3 … 3, hitbox ±0.72, mirrors ±4), attackLine, resolveShot, hitChance
  duel.ts        the Duel state machine: hands, AP, wards, hexes; emits DuelEvent[]; previewPlan()
  ai.ts          enumerates every legal play sequence; scores damage dealt minus caution × threatAt(where it ends up); softmax by sloppiness
  rng.ts         seeded Mulberry32 + Box–Muller; duels and tests are reproducible
  types.ts       action types (spell | movement | alteration | ward | hex), Card, Play, DuelEvent
src/content/   data only
  actions.ts     every action; enemyOnly ones are never offered to the player
  characters.ts  apprentice + 3 opponents, each with a look, sloppiness, intro and lesson
  run.ts         the 3-duel run: the cards each win offers, +1 ♥ per win, run statistics
src/render/    canvas
  sketch.ts      hand-drawn primitives and the INK palette
  wizard.ts      the doodle wizard
  battlefield.ts axes, bands, previews, shots, wards, bursts, floats, impact marks, marginalia
  particles.ts   pen-mark particles (ticks, stars, dots) and confetti
  tween.ts       animate(), wait(), reducedMotion(), nextFrame() (rAF with a timer fallback)
src/ui/        DOM
  duelView.ts    turn flow, queueing, landing ghost, AI playback, coaching triggers, stats (aim preview only with ?aim)
  cards.ts       card markup and the sketchy SVG mini-graph on each card
  hud.ts         name strips, hearts, stars, "jinxed" chip
  coach.ts       Professor Hoot's once-only sticky notes (persisted in localStorage)
  rules.ts       the rules sticky note: shown before your first duel, reopened from "? rules"
  actionList.ts  the "Action list" page: every action by type, sorted by when you can first use it
src/audio/sfx.ts  WebAudio synth; mute persisted in localStorage
src/main.ts    screens: title, run intro → duel → reward → …, result scrolls, portraits, dev hooks
src/styles/main.css  the whole notebook look; CSS variables at the top
```

**Flow of a turn.** `Duel` resolves everything instantly and returns events; `DuelView.run()` replays them through `Battlefield.play()` as animations. The core never touches the DOM or the canvas; the UI never rolls dice. Keep it that way.

**Coordinate frames.** Each wizard casts in its own frame: `x` is distance travelled (0 at the caster, 1 at the target), `y` is relative to the caster's lane. `toWorldX`/`toLocalX` in `shot.ts` convert. The right-hand wizard's frame is mirrored.

**Queue semantics.** Alterations queued after a spell slot in *before* it (`DuelView.withPlay`), so "Flame, then Intercept" raises the Flame's intercept. Alterations with no spell after them are wasted; the AI is penalised for that and the hint text warns the player. Movements keep the order you pick: "Flame, then Move" is a hit and run, and the preview draws a pencil ghost where you'll end up.

## Balance notes

- Seven lanes at whole numbers (−3 … 3) so the axis never shows fractions. A lane (1) is less than a hitbox is tall (±0.72), so one lane off someone's line only partly dodges them. That gradient is what makes duel 1 a game: Flame hits 83% aligned, 30% one lane off, ~1% two lanes off, so "shoot now or line up first?" is a real call. With lanes wider than a hitbox every shot was all or nothing, and the best play was always to stand still and fire. A spread (σ at the target) around 0.4 is reliable and around 1.2 a gamble. Everything is proportional: to rescale the field, scale lanes, hitbox, mirrors, spreads, steps and wards together.
- Other hit chances (internal, never shown while aiming): Frost Ray ≈ 100% for 2 ★, Chain Lightning 54% for 2 damage. A jinxed Flame drops to 51%; with SD ÷ 2 it rises to 99%. Intercept and Slope move a line by 2, i.e. two lanes.
- Flame has a precise start (β₀ σ 0.04) but a wobbly angle (β₁ σ 0.52), so its band is a cone: ±0.08 at the staff, ±0.5 at mid-field, ±1.0 (about a lane) at the target. It's the first picture of "uncertainty grows with distance".
- **AI caution.** Hitting and dodging cost the same 1 ★, so an AI that only counts damage dealt never dodges. Each AI subtracts `caution` × the damage it could take where it ends its turn (`threatAt`: the foe's best mix of moving into line and firing). Low caution slugs it out, high caution hits and runs or keeps away. Caution halves every 3 turns without a hit ("impatience"), so two careful wizards can't circle each other forever (there's a test for that). Harry: caution 0.8, sloppiness 0.4, 4 ♥, starts a lane up so turn one is already a choice.
- Simulated AI-vs-AI with a decent player (sloppiness 0.3): Harry is won ~85% of the time in ~7–11 of your turns, Draco 61–68% (Slope vs. Intercept), Voldemode ~54%. Re-check these after any balance change.
- Apprentice: 5 HP, 2 ★, hand of 3, spellbook of 4 Flame + 3 Move. Each win gives +1 ♥ and one action from that stage's `rewards` in `run.ts`; full heal between duels.
- One idea per opponent. Harry Plotter (Flame + Move only, dodges) teaches reading the band. Draco Malfit (walls at mid-field) teaches slope vs. intercept: changing the slope swings the line into a wall, raising the intercept clears it. Lord Voldemode (Jinx doubles your spread) teaches variance: SD ÷ 2, or a sure 1 over a risky 2.
- With 2 ★, a spell plus two alterations doesn't fit in one turn; that's what Arc (both at once) was for, if walls ever need it again.
- Damage is an integer and Flame already deals the minimum, so "precise but weak" can only mean "precise but costly" (Frost Ray) for now. A finer HP/damage scale would open up that axis.

## Conventions

- TypeScript, strict, `noUnusedLocals`. Formatting: 4-space indent, no semicolons, double quotes, ~160-column lines (the code is Prettier-shaped; keep it consistent by hand, there's no formatter config yet).
- Comments explain *why* or the maths, not what the next line does. Short file-header comments say what a module is for.
- Names: `Action` is any card and `kind` its type (see Vocabulary); `Side` is `"left" | "right"`; `β₀/β₁` are `beta0/beta1`; `sd` is a standard deviation; `sdScale` multiplies it.
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
- `?duel=plotter|malfit|voldemode` on the dev server jumps straight into a quick duel against that opponent; add `&aim` to see the planning preview (band and path) that players don't get.
- In dev, `window.__sas.duel` is the live `Duel` and `window.__sas.run` the run state. Modules can be imported in the browser console with `await import('/src/core/ai.ts')` to script turns (e.g. call `planTurn(duel, "left", 0, rng)` and click the matching `#hand .card[data-uid]`).
- Tips are remembered in `localStorage` (`sas.tips`); use "show tips again" on the title page or clear the key.
- If the canvas looks frozen in an embedded browser, check whether `requestAnimationFrame` is firing before suspecting the renderer; `nextFrame()` falls back to a 250 ms timer.

## Roadmap

Open: the Grimoire and spellbook building (see the design direction), a local save for runs, a settings screen, then new actions and opponents following the design direction above.

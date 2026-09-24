# Stats & Sorcery — Plan for the first polished version

Decisions: **notebook doodle** art direction (replaced the earlier *arcane blueprint*) · **Vite + TypeScript** (Bun as package manager / test runner) · **normal sampling with a true 95% CI** · **tutorial + 3-duel run**.

## Core concept

Every attack spell is a linear model, `y = β₀ + β₁·x`, cast from your own position (your y is the origin of your frame). The opponent stands at `x = 1`; the spell hits if the line passes through them. Each cast draws `β₀ ~ N(μ₀, σ₀)` and `β₁ ~ N(μ₁, σ₁)`; the shaded band is the true pointwise 95% interval `μ₀ + μ₁x ± 1.96·√(σ₀² + σ₁²x²)`, so about 1 shot in 20 lands outside it. On cast, the band **collapses** into the single realised line — the lesson and the visual effect are the same thing.

Three things make it fun rather than abstract:

1. **Live aim preview.** Queuing cards updates a ghost line + band in real time, with an exact hit chance (e.g. "Hit chance 72%") computed from the normal distribution.
2. **Wards at mid-field.** With a single target at `x = 1`, slope and intercept are interchangeable. Opponents that place wards at `x = 0.5` force you to route *around* them — slope finally means something different from intercept.
3. **Shot history.** A small histogram on the target's axis shows where your last shots landed; over a duel players watch a normal distribution build up.

## Content (first version)

**Field:** 5 lanes, `y ∈ {−1, −½, 0, ½, 1}`. Modifier steps are ½, so one modifier = one lane.

**Spells (~8)**

| Spell | Kind | Notes |
|---|---|---|
| Firebolt | attack | cheap, medium spread |
| Frost Ray | attack | cost 2, narrow spread |
| Chain Lightning | attack | wide spread, 2 damage |
| Shift (β₀ ±½) | modifier | one card, choose up/down |
| Tilt (β₁ ±½) | modifier | one card, choose up/down |
| Focus | modifier | halves the spread of your next attack |
| Blink | move | move one lane |
| Ward | opponent-only | blocks one shot at mid-field |
| Jinx | opponent-only | doubles your spread next turn |

Cards show a plain name with the symbol beside it ("Start β₀", "Tilt β₁") and a tiny graph instead of a number table.

**Characters (4)**

- **Professor Hoot** — owl mentor, tutorial narrator
- **Wobbly Wendel** — wide spreads, dodges a lot; teaches intercept
- **Warden Lin** — places wards; teaches slope
- **The Outlier** (boss) — heavy variance, Jinxes you; teaches uncertainty management

**Structure:** 3-lesson tutorial (intercept → slope → uncertainty), then 3 duels with "pick 1 of 3 new spells" between fights, then a run summary. Each lesson unlocks a **Grimoire** page (short plain-language explanation). Hot-seat PvP keeps working but gets no extra polish yet.

## Look & feel

The game is a page in a bored-but-talented student's notebook: squared paper with a red margin and punched holes, everything drawn with ballpoint, pencil and highlighter during a dull class, daydreaming about wizard duels.

- **Paper**: cream squared paper, light-blue grid, red margin line, subtle grain. Cards are index cards taped to the desk, each tilted a little; results arrive on scrolls; tips are sticky notes.
- **Ink**: outlines in ballpoint blue (`#1e2a5a`), guides in pencil, corrections and damage in red pen, emphasis in yellow highlighter. Spell families are pens: fire red-orange, frost blue, storm purple, arcane ballpoint, nature green, shadow pink.
- **Hand-drawn lines**: `src/render/sketch.ts` draws every line with small deterministic wobbles; re-seeding ~8 times a second gives the "line boil" of hand-drawn animation. Bands are pencil hatching, fills are coloured pencil.
- **Wizards**: cute doodles (big head, dot eyes, rosy cheeks, pointy hat with a star patch, a staff with a star), with idle bob, blinks, casting eyebrows, × eyes when hit, happy/sad faces at the end. Each opponent has a distinguishing extra (beard, glasses, cape).
- **Juice**: comic "POW!/BAM!/ZAP!" bursts on hit, "whiff~" and a pencil puff on a miss, "CLANK" on a wall, page shake, hearts scribbled out, confetti stars on victory, pencil-scratch/whoosh/pop sound effects.
- **Fonts**: Permanent Marker (titles, names), Patrick Hand (UI), Caveat (annotations and numbers).
- Reduced-motion support, mute toggle, keyboard play (1–6 pick cards, Enter casts, Esc clears). Desktop-first, tablet-OK.

## Architecture

```
src/core/      pure logic, no DOM: seeded RNG + normal sampling, hit-chance maths, duel state machine, AI
src/content/   spells, characters, encounters, tutorial script (data only)
src/render/    canvas battlefield, vector wizards, particles, tweens, camera shake
src/ui/        cards, HUD, screens (menu, reward, summary, Grimoire), dialogue
src/audio/     tiny synthesised SFX (WebAudio)
```

- The core resolves actions instantly and emits **events**; the UI plays them back as animations.
- AI enumerates every legal play sequence (small with 3 cards / 2 AP), scores expected damage + utility, and picks with a per-opponent "sloppiness" temperature.
- Tests (`bun test`): analytic hit chance matches Monte Carlo; ~95% of shots land inside the band; duel rules.
- Deploy: GitHub Actions → GitHub Pages.

## Phases

| Phase | Scope | Exit criterion |
|---|---|---|
| **0. Foundation** ✅ | Vite+TS scaffold; port logic into `core` with tests; normal sampling; compress banner; retire pixel sprites | Tests green, a basic duel runs |
| **1. One duel that feels great** ✅ | Notebook battlefield, doodle wizards, aim preview + hit %, paper cards, HUD, all juice | **Review point:** one duel that looks finished |
| **2. Teaching** (mostly done) | Hoot's contextual sticky notes instead of a scripted tutorial, wards, Focus/Jinx, 3 opponents + AI, shot histogram. Still open: the Grimoire | Playable up to the boss |
| **3. The run** (done, no save yet) | Encounter sequence, reward picks, +1 ♥ per win, run summary. Still open: local save | Full run start to finish |
| **4. Polish** (partly) | Sound ✅, keyboard ✅, responsive ✅. Deploy workflow ✅. Still open: settings screen | Live on Pages |

## Defaults / deferred

- Hit % always shown in the tutorial and first duel, then a "Show odds" setting (on by default).
- Character names are placeholders.
- The painted banner stays in the README only; the title screen is hand-lettered to match the doodle direction.
- Deferred: charge-to-cast spells, skill tree, cosmetics, online play.

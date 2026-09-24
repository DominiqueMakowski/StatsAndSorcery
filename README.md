![](src/assets/banner.webp)

# Stats & Sorcery

Educational game for developing your intuition of statistics.

> Currently a proof-of-concept prototype.

## Overview, Features and Open Questions

### Implementation

- Implementation: javascript? For easy Online playability and distribution?
- Graphics style: doodles in a school notebook (was: pixel art?)

### Game mechanisms

- Inspiration
  - Bowmaster: Prelude, Strong Bow
  - Gwent, Hearthstone, Magic: The Gathering
  - Baldur's Gate 3 (turn-based combat)
- The player controls a wizard that can cast spells. 
  - Offensive spells are characterized by a set of parameters (e.g., Intercept, Slope, Confidence Interval) and can have different types (e.g., fireball, pushback, freeze...)
  - There are also passive or active spells (e.g., decrease confidence interval, add noise to other wizards' spells, defensive shields, etc)
  - When leveling-up, the player can choose new spells or select items that grant passive modifiers (e.g., a hat that gives more spells actions or increases spell deck).
- The player battles adversaries in duels (levels) of increasing difficulty.
- The player has an active set of spells (the "deck") which is updated each turn, drawing randomly from the "spellbook".
- Each turn, the player has a limited number of actions, and select a sequence of spells to cast.
- Some of these modifiers will require the player to press longer (e.g., Increase Slope (variable) requires the player to press longer (to "charge" the spell) to increase the slope more)

## Development

The plan for the first polished version lives in [docs/PLAN.md](docs/PLAN.md).

### Running locally

Requires [Bun](https://bun.sh).

```sh
bun install
bun run dev      # dev server at http://localhost:5173
bun test         # core rules & statistics tests
bun run build    # production build in dist/
```

> **Note:** `index.html` at the repo root is the Vite *source* page: it loads TypeScript directly, so opening it from disk or from a plain static server shows a blank page. Use `bun run dev` and open the printed URL, or run `bun run build` and serve the `dist/` folder (any static server works, e.g. `bunx serve dist`).

### Playing online

- **Main game**: every push to `main` runs [`pages.yml`](.github/workflows/pages.yml), which builds the game and publishes `dist/` to the root of the `gh-pages` branch, served at <https://dominiquemakowski.github.io/StatsAndSorcery/>.
- **PR previews**: every pull request runs [`pr-preview.yml`](.github/workflows/pr-preview.yml), which publishes its own build to `pr-preview/pr-<number>/` on the same branch and comments the link on the PR. The preview is updated on each push and removed when the PR closes, so the main game and any number of in-progress versions are playable side by side.
- **One-time setup**: after the first push, in the repository settings choose **Pages → Build and deployment → Source: Deploy from a branch → `gh-pages`, folder `/ (root)`**.

Orientation for contributors and AI agents (intent, art direction, architecture map, conventions) lives in [AGENTS.md](AGENTS.md).

### Current Status (v0.4 — one duel that feels finished, plus a run)

- **Tech Stack**: Vite + TypeScript. Pure game logic in `src/core` (tested with `bun test`), content in `src/content`, canvas rendering in `src/render`, DOM UI in `src/ui`, synthesised sound in `src/audio`.
- **Art direction**: *a bored student's notebook*. The whole game is a page of squared paper; the battlefield axes are ruler-drawn in ballpoint, uncertainty bands are pencil hatching, hits are comic-book "POW!" bursts in red pen, and the wizards are cute doodles that "boil" like hand-drawn animation. Cards are index cards taped to the desk; results arrive on scrolls and sticky notes. Everything is drawn in code (`src/render/sketch.ts` holds the wobbly-line primitives), no image assets.
- **Statistics**: each cast draws β₀ and β₁ from normal distributions; the hatched band is the true 95% interval, the aim preview shows the exact hit chance, and pen crosses on the target's axis build up a histogram of where your shots landed.
- **Modes**: *Start a run* (Wobbly Wendel → Warden Lin → The Outlier, with a new spell for your book and +1 ♥ after each win, then a summary comparing "landed" with "what the odds said"), *Quick duel* vs Wendel, and hot-seat *Two players*.
- **Teaching**: Professor Hoot leaves contextual sticky notes (first turn, target off your line, a wall at mid-field, being jinxed, a high-odds miss, a shot outside the band). Each note shows once; "show tips again" on the title page resets them.
- **Feel**: keyboard play (1–6 pick cards, Shift+number for "down", Enter casts, Esc clears), pencil-scratch and whoosh sound effects with a mute toggle, reduced-motion support, a `?duel=lin` URL shortcut for testing a specific opponent.

### Roadmap (prototype era)

- [x] Basic browser-based implementation with simple pixel-art graphics
- [x] Player and Enemy sprites with animations
- [x] Coordinate system with dynamic origin and ruler ticks
- [x] Spellbook with Attack, Modifier, and Movement spells
- [x] Visual effects (Particles, Projectiles, Rays, Pre-cast animations)
- [x] **Confidence Intervals**: true 95% bands, exact hit chances, shot histogram.
- [x] **Notebook-doodle art direction**: paper, pen, pencil and highlighter, all drawn in code.
- [x] **A run**: three opponents, spell rewards, contextual coaching, sound.
- [ ] **Progression**: 
  - Level-up system, unlocking new spells and items.
  - Skill tree (more action points, HP, ...) 
  - New opponents with different skills. 
  - Different player selection (character creation with various archetypes, e.g., spell caster vs. hunter with bow). 
  - Evolutive skins and cosmetics when advancing levels (from basic monk robe to advanced wizard robes with crowns etc.).
  - As the player progresses and gains more HPs, spells with more damage appear, with more complex trajectories to master (polynomials and interactions).
- [ ] **Advanced AI**: Smarter enemy behavior beyond random selection.
- [ ] **Sound**: Add sound effects for casting, hits, and movement.
- [ ] **Online Multiplayer**: Play against remote opponents.
  - Tournament mode for classrooms or groups.

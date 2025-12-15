![](img/banner.png)

# Stats & Sorcery

Educational game for developing your intuition of statistics.

> Currently a proof-of-concept prototype.

## Overview, Features and Open Questions

### Implementation

- Implementation: javascript? For easy Online playability and distribution?
- Graphics style: pixel art?

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

### Current Status (v0.2)

- **Tech Stack**: HTML5 Canvas + Vanilla JavaScript.
- **Graphics**: Pixel art sprites for wizards and spell effects.
- **Battlefield**: 
  - Dynamic coordinate system where Y=0 is relative to the active player.
  - Ruler-style axes on the edges of the screen.
- **Gameplay**:
  - Turn-based combat (Player vs AI or PvP).
  - Action Point system (2 AP per turn).
  - Card-based spell casting with multiple selections allowed.

### Roadmap

- [x] Basic browser-based implementation with simple pixel-art graphics
- [x] Player and Enemy sprites with animations
- [x] Coordinate system with dynamic origin and ruler ticks
- [x] Spellbook with Attack, Modifier, and Movement spells
- [x] Visual effects (Particles, Projectiles, Rays, Pre-cast animations)
- [ ] **Confidence Intervals**: Implement visual noise in spell trajectories based on CI parameters.
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

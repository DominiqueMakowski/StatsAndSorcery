![](src/assets/banner.webp)

# Stats & Sorcery

*A wizard duelling game to build your statistical intuition.*

**[Play it in your browser](https://dominiquemakowski.github.io/StatsAndSorcery/)** (early prototype)

Spells never fly exactly where you aim. The hatched band on the battlefield is where 95% of your casts will land; how likely you are to hit is for you to judge. Line up, cast, dodge. After a few duels, spread, intervals and probabilities start to *feel* obvious.

You start with two cards, **Flame** and **Move**. Each win adds one more: first alterations that bend your spells, then spells that trade precision for power.

## Development

Requires [Bun](https://bun.sh).

```sh
bun install
bun run dev      # dev server
bun test         # core rules & statistics tests
bun run build    # production build in dist/
```

`index.html` is Vite's source page, so it only works through `bun run dev`, or by building and serving `dist/`.

Every push to `main` is published to GitHub Pages, and every pull request gets its own playable preview linked in a comment (see `.github/workflows/`).

Design direction, art direction, architecture and conventions are in [AGENTS.md](AGENTS.md).

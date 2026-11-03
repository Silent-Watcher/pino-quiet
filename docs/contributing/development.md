# Development

## Getting started

```sh
git clone https://github.com/Silent-Watcher/pino-quiet.git
cd pino-quiet
npm install
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm test` | Vitest unit + integration tests with coverage |
| `npm run tsc` | TypeScript type-check |
| `npm run build` | tsup ESM + declarations |
| `npm run lint` | Biome lint (mutating: `prelint` formats files) |
| `npm run check` | Biome check + format (mutating) |
| `npm run test:pack` | Pack smoke test in a clean consumer project |
| `npm run docs:dev` | VitePress dev server |
| `npm run docs:build` | VitePress production build |
| `npm run docs:preview` | VitePress preview |

## Committing

Husky + lint-staged run `biome check --write` and the full test suite on every commit. Commit messages follow Conventional Commits (`npm run commit`).

## Layout

- `src/` — production code (ESM, strict TypeScript)
- `tests/` — Vitest suite (unit + integration + real Pino)
- `scripts/` — dev tooling (benchmark, pack smoke)
- `bench/` — benchmark harness and results
- `docs/` — VitePress site
- `example/` — runnable examples

## Code style

- Strict TypeScript, single quotes, tabs, 80-column line width.
- Biome enforces formatting and lint; run `npm run check` before pushing.
- Comments explain *why* the code cannot show, not what the next line does.
# Contributing to pino-quiet

Thanks for considering a contribution! This project is small and welcomes issues, discussion, and PRs.

## Getting started

```sh
git clone https://github.com/Silent-Watcher/pino-quiet.git
cd pino-quiet
npm install
```

## Development workflow

```sh
npm run test:watch   # run tests in watch mode while you work
npm run lint         # biome lint
npm run check        # biome format + lint, auto-fixing what it can
npm run tsc          # type-check
npm run build        # produce dist/ via tsup
```

## Before opening a PR

- [ ] `npm test` passes (`vitest run --coverage`).
- [ ] `npm run tsc` passes with no errors.
- [ ] `npm run lint` passes with no errors.
- [ ] New behavior has test coverage in `tests/`.
- [ ] Public API changes are documented in `readme.md` and `CHANGELOG.md`.
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`npm run commit` uses Commitizen to help with this).

## Reporting bugs / requesting features

Please use the issue templates under `.github/ISSUE_TEMPLATE`.

## Code style

Formatting and linting are enforced by [Biome](https://biomejs.dev/) (`biome.json`) and run automatically on commit via Husky + lint-staged.

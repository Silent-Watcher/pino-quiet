# Installation

::: code-group

```sh [npm]
npm i pino-quiet
```

```sh [pnpm]
pnpm add pino-quiet
```

```sh [yarn]
yarn add pino-quiet
```

:::

## Requirements

| Requirement | Value |
| --- | --- |
| Node.js | `>= 20` |
| Pino | `^9.0.0 \|\| ^10.0.0` (peer dependency) |

Pino is installed as a peer dependency, so the transport always runs with the exact Pino instance your application uses.

::: warning Documentation tracks `master`
These requirements, `excludeLevels`, and the direct-`import` fix describe the current `master` branch. Releases up to and including 1.0.1 declare `node >=22.18.0` and `pino ^10.1.0`, and do not include `excludeLevels` or the `import` fix. See the [changelog](https://github.com/Silent-Watcher/pino-quiet/blob/master/CHANGELOG.md) (*Unreleased* section).
:::

## Module format

The package is **ESM-only**. There is no separate CommonJS build.

- `import pinoQuiet from 'pino-quiet'` works on all supported Node versions.
- `require('pino-quiet')` works through native `require(esm)` support on **Node.js 20.19+ and 22.12+**. On older Node versions use `import`.

Standard Pino transport usage (`pino({ transport: { target: 'pino-quiet' } })`) works on all supported Node versions: Pino resolves and loads the target itself.

## TypeScript

TypeScript declarations ship with the package (`dist/index.d.ts`). No `@types` package is needed.

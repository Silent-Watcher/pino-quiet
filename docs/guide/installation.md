# Installation

```sh
npm i pino-quiet
```

```sh
pnpm add pino-quiet
```

```sh
yarn add pino-quiet
```

## Requirements

| Requirement | Value |
| --- | --- |
| Node.js | `>= 20` |
| Pino | `^9.0.0 \|\| ^10.0.0` (peer dependency) |

Pino is installed as a peer dependency, so the transport always runs with the exact Pino instance your application uses.

## Module format

The package is **ESM-only**. There is no separate CommonJS build.

- `import pinoQuiet from 'pino-quiet'` works on all supported Node versions.
- `require('pino-quiet')` works through native `require(esm)` support on **Node.js >= 22.12**. On older Node versions use `import`.

Standard Pino transport usage (`pino({ transport: { target: 'pino-quiet' } })`) works on all supported Node versions: Pino resolves and loads the target itself.

## TypeScript

TypeScript declarations ship with the package (`dist/index.d.ts`). No `@types` package is needed.

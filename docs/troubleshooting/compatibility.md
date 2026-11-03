# Compatibility

## Node.js

| Node version | Status |
| --- | --- |
| >= 20 | Supported |

The package declares `engines.node: ">=20.0.0"`. No Node 22+ API is used in source or dependencies; the floor is `thread-stream@4`, which requires Node >= 20.

`require('pino-quiet')` works through native `require(esm)` on **Node.js >= 22.12**. On older Node versions use `import`.

## Pino

| Pino version | Status |
| --- | --- |
| ^10 | Supported and integration-tested |
| ^9 | Supported and integration-tested (CI job) |

The peer dependency range is `pino: ^9.0.0 || ^10.0.0`. Pino 9 and 10 are both covered by the integration test suite.

## Dependencies

| Dependency | Version | Notes |
| --- | --- | --- |
| `pino-abstract-transport` | ^3.0.0 | stream plumbing |
| `sonic-boom` | ^4.2.0 | destination writer |
| `fast-deep-equal` | ^3.1.3 | strict comparison |

All are maintained and have no known compatibility issues with the declared Node floor.

## Worker threads

Pino serializes transport options with the Structured Clone algorithm. All plain-data options work in both direct factory invocation and standard worker transport. Callback options (`comparator`, `suffixFormat`, `onFlush`) work only with direct factory invocation.

## Bundlers

The package is ESM-only and works with Vite, esbuild, Rollup, and Webpack. `tsup` bundles the published `dist/` as a single ESM file.

## TypeScript

TypeScript declarations ship in `dist/index.d.ts`. No `@types` package is needed. `moduleResolution: "node16"` / `"bundler"` consumers resolve the `import` condition correctly.
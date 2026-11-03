# Compatibility

## Node.js

| Node version | Status |
| --- | --- |
| 20, 22, 24 | Supported — covered by the CI matrix (type-check, Biome, tests, build, pack smoke test) |
| < 20 | Not supported |

The package declares `engines.node: ">=20.0.0"`. No Node 22+ API is used in the source; the floor comes from Pino's own `thread-stream@4` dependency, which requires Node >= 20.

::: warning Unreleased
The `>=20.0.0` floor describes the current `master` branch. Releases up to and including 1.0.1 declare `>=22.18.0`. See the [changelog](https://github.com/Silent-Watcher/pino-quiet/blob/master/CHANGELOG.md).
:::

## `require()` and `import`

The package is ESM-only. `require('pino-quiet')` works through native `require(esm)` on **Node.js 20.19+ and 22.12+** (checked on Node 20.20 and 22.22). On older Node versions use `import`.

## Pino

| Pino version | Status |
| --- | --- |
| ^10 | Supported and integration-tested |
| ^9 | Supported and integration-tested (dedicated CI job) |

The peer dependency range is `pino: ^9.0.0 || ^10.0.0`.

## Dependencies

| Dependency | Version | Notes |
| --- | --- | --- |
| `pino-abstract-transport` | ^3.0.0 | stream plumbing |
| `sonic-boom` | ^4.2.0 | destination writer |
| `fast-deep-equal` | ^3.1.3 | strict comparison |

## Worker threads

Pino serializes transport options with the Structured Clone algorithm. All plain-data options work in both direct factory invocation and standard worker transport. Callback options (`comparator`, `suffixFormat`, `onFlush`) work only with direct factory invocation. See [Pino integration & workers](/guide/pino-integration).

## Bundlers

pino-quiet's test suite runs the package from `node_modules` on Node.js. It does **not** cover bundled applications.

When you pass `target: 'pino-quiet'`, Pino loads the module at runtime inside a worker thread, so a bundler cannot follow that string. If you bundle your app:

- keep `pino-quiet` installed in `node_modules` at runtime and mark it as external, or
- skip the worker and [call the factory directly](/api/factory) (`pino(await pinoQuiet(options))`), which is an ordinary import that bundlers can see.

## Published files

The published `dist/` contains several small ES modules plus `.d.ts` files (not a single bundled file). Only the package root is exported, so deep imports such as `pino-quiet/dist/utils.js` are not supported.

## TypeScript

Declarations ship in `dist/index.d.ts`; no `@types` package is needed. Type resolution was verified with TypeScript 5.9.3 for ESM and CommonJS consumers under `moduleResolution` set to `nodenext`, `bundler`, and `node10`.

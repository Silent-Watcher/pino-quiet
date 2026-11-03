# Migrating from 0.9.x

## The stray `]` bug is fixed

Every flushed log line previously had a trailing `]` appended, producing invalid JSON. If you had a workaround stripping it, remove it.

## `flushIntervalMs` now defaults to `5000`

Before 1.0.0 the idle timer was disabled. Now a repeated log that is never followed by a different one auto-flushes after 5 seconds. Set `flushIntervalMs: 0` to restore the old timing.

## Everything else is additive

No option names, defaults, or output structure changed between 0.9.x and 1.0.0. The 1.0.0 release added `pipeline`, `maxRepeats`, `ignoreKeys`, `comparator`, `levelAware`, `caseInsensitive`, `minRepeatsToAnnotate`, `annotateMessage`, `suffixFormat`, `includeTimestamps`, `firstSeenField`, `lastSeenField`, `onFlush`, `mkdir`, `append`, `sync`, and `excludeLevels` — all opt-in.

## Node version

0.9.x ran on Node >= 18. The current package requires Node >= 20. Pino's own `thread-stream` dependency is the floor.

## Module format

0.9.x shipped both CJS and ESM. The package is now **ESM-only**. `require('pino-quiet')` works on Node >= 22.12 through native `require(esm)`; on older Node versions use `import`.

## Run the migration checklist

- [ ] `npm i pino-quiet@latest`
- [ ] Remove any trailing-`]` stripping workaround
- [ ] Set `flushIntervalMs: 0` if you relied on the old idle behavior
- [ ] Verify `require` vs `import` on your Node version
- [ ] Run the integration tests: `npm test`
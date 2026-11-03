# Migrating from 0.9.x

Moving from 0.9.x to 1.x needs at most two small checks. If you are already on 1.0.x, see [Upgrading from 1.0.x](/migration/from-1.x).

## The stray `]` bug is fixed

Every flushed log line previously had a trailing `]` appended, producing invalid JSON. If you had a workaround stripping it, remove it.

## `flushIntervalMs` now defaults to `5000`

Before 1.0.0 the idle timer was disabled. Now a repeated log that is never followed by a different one auto-flushes after 5 seconds. Set `flushIntervalMs: 0` to restore the old timing.

## Everything else is additive

No option names, defaults, or output structure changed between 0.9.x and 1.0.0. The 1.0.0 release added `pipeline`, `maxRepeats`, `ignoreKeys`, `comparator`, `levelAware`, `caseInsensitive`, `minRepeatsToAnnotate`, `annotateMessage`, `suffixFormat`, `includeTimestamps`, `firstSeenField`, `lastSeenField`, `onFlush`, `mkdir`, `append`, and `sync` — all opt-in. [`excludeLevels`](/guide/excluded-levels) was added later and is not part of 1.0.0.

## Node version

0.9.x and 1.0.x declared `engines.node: ">=22.18.0"`. The current `master` declares `>=20.0.0`, so the floor went **down** and no action is needed. See [Compatibility](/troubleshooting/compatibility).

## Module format

0.9.x was already **ESM-only** (`"type": "module"`, ESM build); this did not change in 1.0.0. `require('pino-quiet')` works on Node.js versions with native `require(esm)` support (20.19+ and 22.12+). On older versions use `import`.

## Migration checklist

- [ ] `npm i pino-quiet@latest`
- [ ] Remove any trailing-`]` stripping workaround
- [ ] Set `flushIntervalMs: 0` if you relied on the old idle behavior
- [ ] Check that your log pipeline parses the output as NDJSON (one JSON object per line)

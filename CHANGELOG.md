# Changelog

All notable changes to this project are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### 🚨 Fixed

- **`import pinoQuiet from 'pino-quiet'` now works.** The `exports` map was
  missing `import`/`default` conditions, so any direct ESM import of the
  package failed with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Standard
  `pino({ transport: { target: 'pino-quiet' } })` usage was unaffected
  (Pino resolves targets through `require`), and the native
  `require(esm)` interop path is preserved.
- **Pipeline mode no longer silently discards the buffered log on teardown.**
  When a pipeline transport is destroyed or errors before a normal end, the
  pending (possibly collapsed) log is now emitted to `stderr` instead of
  being dropped. Previously it was lost on any non-normal shutdown.
- **A throwing `comparator` no longer crashes the process.** The error is
  caught, reported to `stderr`, and the record is treated as *not* a
  duplicate (the pending batch is flushed) so logging continues. Previously
  the exception propagated out of the stream as an uncaught error.
- **A throwing `suffixFormat` no longer crashes the flush.** The error is
  caught and reported to `stderr`, and the log is emitted without the
  suffix (the `countField` is still set). Previously the exception
  propagated and could abort a flush.
- **Strict-mode records carrying an own `__proto__` key (possible via
  `JSON.parse`) now compare correctly.** Building the comparable object
  previously mutated the temporary object's prototype instead of copying
  the key, changing deep-equality results. The temporary object's prototype
  is no longer touchable.
- **`NaN` numeric options are now rejected.** `maxRepeats: NaN` previously
  passed validation and effectively disabled force-flushing;
  `flushIntervalMs: NaN` reached `setTimeout`, which coerces `NaN` and
  fires almost immediately. All three numeric options now throw a clear
  `RangeError` for `NaN` and non-number values (`Infinity` remains valid
  for `maxRepeats`).

### ✨ Added

- Real Pino integration test suite: worker-transport destination mode,
  pipeline with `pino/file` and `pino-pretty`, worker serialization
  compatibility matrix (plain-data options must clone; callback options
  must fail with `could not be cloned`), and direct factory invocation
  covering `comparator`/`suffixFormat`/`onFlush`.
- `npm run test:pack` — packs the tarball, installs it into a clean
  consumer project, and verifies ESM import, `require(esm)` interop,
  Pino transport discovery, destination mode, pipeline mode, and the
  shipped TypeScript declarations.
- Construction-time validation for JS consumers bypassing the TypeScript
  types: non-function `comparator`/`suffixFormat`/`onFlush`, non-array or
  non-string-entry `ignoreKeys`, and empty or `__proto__` values for
  `countField`/`firstSeenField`/`lastSeenField` now throw a `TypeError`
  with a clear message instead of failing unpredictably later.
- Pipeline-mode transports expose their internal collapsing Transform via
  the exported `INTERNAL_TRANSFORM` symbol (for tests and introspection).

### 💼 Changed

- Node.js engine floor lowered from `>=v22.18.0` to `>=20.0.0` to match
  the actual runtime requirements (no Node 22+ API is used; Pino's own
  `thread-stream` dependency is the floor). Backward-compatible.
- Peer dependency range widened from `pino ^10.1.0` to
  `pino ^9.0.0 || ^10.0.0`; Pino 9 is covered by an integration-test job.
- CI replaced by a single quality workflow: Node 20/22/24 matrix running
  TypeScript, Biome, full tests, build, and the pack smoke test; a Pino 9
  compatibility job; explicit `permissions: contents: read`; no
  badge-committing pushes from CI. The Dependabot config file was renamed
  to the recognized lowercase filename with invalid keys removed.

## [1.0.0]

### 🚨 Fixed (was silently corrupting output)

- **Critical:** every flushed log line had a stray `]` appended to it
  (`` `${JSON.stringify(lastLog)}]\n` ``), producing invalid JSON on every
  single write. Any downstream consumer expecting NDJSON (log shippers,
  `pino-pretty`, `jq`, etc.) would fail to parse pino-quiet's output. Fixed.
- The transport previously registered cleanup logic in two places (end of
  the consumption loop *and* the `close` hook), which could race and call
  `destination.end()` twice, sometimes causing the final buffered log to be
  dropped. Cleanup now happens in exactly one place.

### ✨ Added

- **Pipeline / `pino-pretty` compatibility** — new `pipeline: true` option
  turns pino-quiet into a pass-through Transform instead of a terminal
  transport, so it can be placed *before* `pino-pretty` (or any other
  transport) in a `pino.transport({ pipeline: [...] })` chain. See
  [Composing with other transports](#composing-with-other-transports).
- `flushIntervalMs` — auto-flushes a buffered/repeated log after this many
  milliseconds of silence, so a long-running, low-traffic process never
  hides a stale final count indefinitely. **Defaults to `5000`** (this is a
  behavior change from 0.9.x, which never auto-flushed; set to `0` to
  restore the old "only flush on a new/different log or shutdown" behavior).
- `maxRepeats` — force-flushes once a buffered log has repeated this many
  times, instead of buffering indefinitely in a hot loop. Disabled by
  default (`Infinity`).
- `ignoreKeys` — additional fields to exclude from `strict`-mode
  comparisons, merged with the built-in defaults (`time`, `pid`,
  `hostname`).
- `comparator` — a custom `(previous, current) => boolean` function that
  completely overrides the built-in `strict`/simple comparison logic.
- `levelAware` — when `true`, logs at different levels are never merged
  even if their message matches (e.g. an `info` and an `error` with the
  same text). Defaults to `false` to match pre-1.0 behavior.
- `caseInsensitive` — case-insensitive `msg` comparison in non-strict mode.
- `minRepeatsToAnnotate` — only annotate (mutate `msg` / set `countField`)
  once the repeat count reaches this threshold. Defaults to `1`.
- `annotateMessage` — set to `false` to leave `msg` untouched and only set
  `countField`, useful for structured-logging consumers that parse `msg`
  verbatim.
- `suffixFormat` — customize the `" (xN)"` suffix appended to `msg`.
- `includeTimestamps`, `firstSeenField`, `lastSeenField` — optionally add
  first/last-seen epoch-ms timestamps to every flushed (collapsed) log.
- `onFlush(log, meta)` — a hook called every time a (possibly collapsed)
  log is about to be written/pushed, useful for metrics/observability.
  Exceptions thrown inside it are caught and reported to `stderr` instead
  of crashing the transport.
- `mkdir`, `append`, `sync` — passed straight through to the underlying
  `SonicBoom` destination for more control over file-based destinations.
- Input validation: `maxRepeats < 1`, `flushIntervalMs < 0`, and
  `minRepeatsToAnnotate < 1` now throw a clear `RangeError` at
  construction time instead of behaving unpredictably later.

### 💥 Breaking changes

- **Node.js `>=18`** is now required (was `>=v22.18.0` in the `engines`
  field, though nothing in 0.9.x actually needed Node 22).
- **`flushIntervalMs` defaults to `5000`**, not disabled. A repeated log
  that is never followed by a different one will now be flushed to output
  after 5 seconds instead of sitting buffered until the process exits.
  Set `flushIntervalMs: 0` to opt out and restore the exact 0.9.x timing.
- The published package now only ships a single bundled `dist/index.js`
  (previously `tsup` was configured to glob `src/*`, which could emit
  stray extra chunks). No import path changes for consumers using
  `import pinoQuiet from 'pino-quiet'`.

### 🧪 Tests

- Added a full Vitest suite (unit + integration) covering: simple and
  strict-mode dedup, `ignoreKeys`, `levelAware`, `caseInsensitive`, custom
  `comparator`, `maxRepeats`, `flushIntervalMs` (via fake timers),
  `minRepeatsToAnnotate`, `annotateMessage`, `suffixFormat`,
  `includeTimestamps`, `onFlush` (including a throwing hook), destination
  mode end-to-end (real temp files), pipeline mode end-to-end (including
  piping into another stream and into real `pino-pretty`), and a
  regression test for the stray-`]` bug. ~99% statement coverage.

### 📚 Docs

- Rewritten `readme.md` with a full options reference table, a
  "Composing with other transports" section covering `pino-pretty` and
  multi-target pipelines, migration notes from 0.9.x, and troubleshooting
  tips.

## [0.9.1] and earlier

See git history — this was the last pre-1.0 release, and predates this
changelog.

# PROJECT_AUDIT.md — Phase 0 Repository Audit

Date: 2026-11-03 · Package: `pino-quiet` · Manifest version: `1.0.1` · npm `latest`: `1.0.1` · Git tag: `v1.0.0` (no `v1.0.1` tag)

This is a read-only audit. No runtime code, public API, or package version was changed.

---

## 1. Repository Inventory

| Path | Purpose | Notes |
|---|---|---|
| `src/index.ts` | Transport factory: destination mode + pipeline mode | Default export `pinoQuiet(opts)` |
| `src/deduper.ts` | Collapsing engine (buffer, repeat count, timer, flush) | Framework-agnostic class |
| `src/utils.ts` | `resolveOptions`, `getComparable`, `isDuplicate` | Validation + comparison logic |
| `src/constants.ts` | `DEFAULTS`, `DEFAULT_IGNORE_KEYS` | Single source of defaults |
| `src/types.ts` | `PinoQuietOptions`, `ResolvedOptions`, `LogRecord`, `FlushMeta` | Public TS surface |
| `tests/` | 4 files, 41 tests (unit + transport integration) | Vitest + v8 coverage |
| `example/` | 2 runnable Pino examples | Destination + pipeline-with-pretty |
| `tsup.config.ts` | ESM bundle, dts, minify, `entry: ['src/*']` | See finding F-4 |
| `tsconfig.json` | strict, noEmit, ES2023, `module: preserve` | Type-check only |
| `vitest.config.ts` | node environment, `tests/**/*.test.ts` | No coverage thresholds configured |
| `biome.json` | Format + lint, tabs, single quotes, width 80 | |
| `.github/workflows/coverage.yaml` | Only workflow: Node 20, test, badge commit-push | See findings F-5..F-8 |
| `.github/DEPENDABOT.yml` | Uppercase filename | See finding F-9 |
| `.husky/pre-commit` | lint-staged + full `npm test` on every commit | |
| `.npmignore`, `package.json files` | `files` allowlist wins: `dist`, `readme.md`, `LICENSE`, `CHANGELOG.md` | |
| `readme.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` | Docs | See doc inconsistencies below |
| Working tree | `package-lock.json` modified | Version-sync only (`1.0.0` → `1.0.1` in lockfile, uncommitted) |

---

## 2. Architecture Analysis

Execution flow: **Pino → thread-stream Worker → pino-abstract-transport source (parsed objects) → Deduper.ingest → isDuplicate comparison → bufferedLog/timer → flush → emit → SonicBoom (destination) or Transform.push (pipeline)**.

### Module responsibilities

- **`Deduper`** owns all collapsing state: `bufferedLog`, `repeatCount`, `firstSeen`/`lastSeen`, and the flush timer. It owns no stream and no file handle; it delegates emission to an injected `emit(line)` callback. `flush()` is idempotent (clears timer, nulls buffer). `destroy()` only clears the timer — the buffered log is intentionally preserved so close-time `flush()` can emit it.
- **`buildDestinationTransport`** owns a `SonicBoom` instance (fd/path `destination`, default `1`). The `build(..., { close })` hook is the single teardown point: `flush → destroy → dest.end() → await once(dest, 'close')`. Destination `'error'` events are caught and reported to stderr (prevents process crash).
- **`buildPipelineTransform`** owns a `Transform` (objectMode). `deduper.flush()` runs in the Transform's `_flush` (normal end only); `build(..., { close })` clears timers. `enablePipelining: true` makes pino-abstract-transport wire it into Pino's pipeline plumbing.
- **`resolveOptions`** merges defaults and performs the only validation that exists (three `RangeError` guards).

### State / resource ownership summary

| Resource | Owner | Cleanup path |
|---|---|---|
| Buffered log + counters | `Deduper` | `flush()` on: different log, `maxRepeats`, timer expiry, stream end |
| Timer | `Deduper` | `clearTimer()` on every flush/arm; `destroy()` |
| SonicBoom | destination transport | `close` hook of `build()` |
| Transform | pipeline transport | `autoDestroy: true` + `_flush` |

### Identified lifecycle / concurrency risks (detail in §4)

- Pipeline-mode `close(err, cb)` discards the buffered log on the error path (Transform `_flush` does not run after destroy).
- Pipeline `transform.push(line)` and destination `dest.write(line)` return values (backpressure) are ignored.
- `await once(dest, 'close')` after `dest.end()` assumes SonicBoom always emits `close` asynchronously; a `sync: true` failure path is untested.
- Timer flush callback mutates and emits from a `setTimeout` tick — safe single-threaded, but interacts with worker-thread teardown ordering.

---

## 3. Public API Inventory (verified from implementation, not docs)

| Option | Type | Default (from `constants.ts`) | Current behavior | Destination mode | Pipeline mode | Survives Worker serialization |
|---|---|---|---|---|---|---|
| `destination` | `string \| number` | `1` | Passed to SonicBoom `dest` | Yes | Ignored | Yes |
| `strict` | `boolean` | `false` | Deep-object comparison minus `ignoreKeys` | Yes | Yes | Yes |
| `countField` | `string` | `'repeats'` | Field receiving total occurrence count | Yes | Yes | Yes |
| `ignoreKeys` | `string[]` | built-ins `time, pid, hostname` (user keys **merged**, deduped) | Excluded from strict comparison | Yes | Yes | Yes |
| `comparator` | `(prev, curr) => boolean` | — | Overrides strict/simple; `levelAware` still checked **first** | Yes | Yes | **No — DataCloneError** |
| `levelAware` | `boolean` | `false` | Different `level` never matches | Yes | Yes | Yes |
| `caseInsensitive` | `boolean` | `false` | Lowercase `msg` compare (simple mode only) | Yes | Yes | Yes |
| `maxRepeats` | `number` | `Infinity` | Force-flush when **total occurrences** reach N | Yes | Yes | Yes (finite values) |
| `flushIntervalMs` | `number` | `5000` | Auto-flush after N ms silence; `0` disables | Yes | Yes | Yes |
| `minRepeatsToAnnotate` | `number` | `1` | Annotate only when total ≥ N | Yes | Yes | Yes |
| `annotateMessage` | `boolean` | `true` | If false, only `countField` is set | Yes | Yes | Yes |
| `suffixFormat` | `(count) => string` | `` (c) => ` (x${c})` `` | Custom suffix | Yes | Yes | **No — DataCloneError** |
| `includeTimestamps` | `boolean` | `false` | Adds `firstSeen`/`lastSeen` to **every** flushed log | Yes | Yes | Yes |
| `firstSeenField` | `string` | `'firstSeen'` | Field name | Yes | Yes | Yes |
| `lastSeenField` | `string` | `'lastSeen'` | Field name | Yes | Yes | Yes |
| `onFlush` | `(log, meta) => void` | — | Called pre-emit; throws caught → stderr | Yes | Yes | **No — DataCloneError** |
| `pipeline` | `boolean` | `false` | Transform mode | n/a | — | Yes |
| `mkdir` | `boolean` | `false` | → SonicBoom | Yes | Ignored | Yes |
| `append` | `boolean` | `true` | → SonicBoom | Yes | Ignored | Yes |
| `sync` | `boolean` | `false` | → SonicBoom | Yes | Ignored | Yes |

### Repeat-count semantics (verified from `deduper.ts`)

- `countField` and the `meta.repeats` value are **total occurrences** in the batch (first + repeats), not additional repeats. A batch of 3 identical logs emits `repeats: 3`.
- `maxRepeats: N` flushes when total occurrences reach N (`repeatCount + 1 >= maxRepeats` on the Nth).
- `minRepeatsToAnnotate: N` suppresses `countField`/msg-suffix when total < N; timestamps (if enabled) are still added regardless.
- Annotation (msg suffix + countField) is only applied when `repeatCount > 0`; a single un-repeated log is emitted untouched.

### Option precedence in `isDuplicate` (verified order)

1. `levelAware` level check (returns false on mismatch) — applies **even when `comparator` is set**
2. `comparator` (if set, its return value is final)
3. `strict` deep-equal via `fast-deep-equal` on `getComparable(...)`
4. Simple `msg` compare; non-string `msg` falls back to deep-equal; `caseInsensitive` applies to strings only

### Docs-vs-code verification results

| Claim | Source docs | Code reality | Verdict |
|---|---|---|---|
| README requires Node `>= 18` | readme.md:66, CHANGELOG | `engines.node: ">=v22.18.0"` | **Contradiction (F-1)** |
| "only ships a single bundled `dist/index.js`" | CHANGELOG 1.0.0 | tsup emits 5 files (`index`, `deduper`, `utils`, `constants`, `types.js` 0 B) | **Contradiction (F-4)** |
| README CI badge `ci.yaml` | readme.md:23 | Only `coverage.yaml` exists | **Broken badge (F-5)** |
| `comparator` "completely overrides" built-in logic | types.ts / readme | True, except `levelAware` gate runs first | Partially undocumented |
| `onFlush` "Never throws" | types.ts / readme | Correct — caught, stderr | Accurate |
| `ignoreKeys` default `[] (merged with built-ins)` | readme table | Actual resolved value is the built-ins array | Misleading notation |

---

## 4. Bug and Risk Analysis

Classifications: **[CONFIRMED]** reproduced · **[LIKELY]** strong evidence, repro pending · **[RISK]** reliability concern · **[DOC]** documentation inconsistency · **[PKG]** packaging · **[TEST]** missing coverage · **[IMPROVE]** optional.

### F-1. Node engine contradiction — [DOC]
README and CHANGELOG 1.0.0 say Node `>= 18`; `engines` says `>=v22.18.0`. Runtime uses no Node-22-only API (verified: `node:events`, `node:stream`, `setTimeout.unref`, standard ESM). Must be reconciled in Phase 2E with a documented minimum and a compatibility matrix.

### F-2. `exports` map breaks direct ESM import — [CONFIRMED] packaging bug
`package.json` exports only `{ ".": { "require": "...", "types": "..." } }`. Verified in a clean consumer project on Node 24:
- `import 'pino-quiet'` → **`ERR_PACKAGE_PATH_NOT_EXPORTED`**
- `require('pino-quiet')` → works (native `require(esm)`, the file is ESM but Node ≥22.12 loads it)
- `pino({ transport: { target: 'pino-quiet' } })` → works, because Pino resolves the target with `createRequire(context).resolve(origin)` and thread-stream imports the absolute file URL, bypassing the exports map.

So the flagship usage works by accident of Pino's resolver; any consumer doing `import pinoQuiet from 'pino-quiet'` (documented in types: the default export) fails. Fix: add `import` and `default` conditions. Backward-compatible fix; SemVer PATCH/MINOR classification in Phase 2.

### F-3. Callback options are unusable via standard Pino worker transport — [CONFIRMED], must be documented
Verified: `comparator` in transport options → `DOMException: () => false could not be cloned.` Same applies to `suffixFormat` and `onFlush` (Structured Clone before `workerData`). This is inherent to Pino transports, not a pino-quiet defect. Required action: accurate documentation (worker-usable options vs direct-factory-only callbacks), tests for both paths. No API removal (per Phase 2C rules).

### F-4. Build output contradicts CHANGELOG — [DOC] + [PKG]
`tsup` `entry: ['src/*']` emits `dist/index.js`, `dist/deduper.js`, `dist/utils.js`, `dist/constants.js`, and an empty `dist/types.js`. CHANGELOG 1.0.0 claims a single bundled `dist/index.js`. Consumers are not affected (only `.` is exported), but the shipped 0-byte `types.js` is dead weight and the CHANGELOG is wrong.

### F-5. README badge points to nonexistent workflow — [CONFIRMED] [DOC]
Badge URL `.../actions/workflows/ci.yaml/badge.svg`; repository has only `coverage.yaml`.

### F-6. CI runs Node 20 against `engines >=22.18.0` — [CONFIRMED] inconsistency
`coverage.yaml` uses `node-version: "20"`. Tests pass on Node 20 (and on local Node 24), but CI does not validate the declared engine floor, and the floor itself is under audit (F-1).

### F-7. CI commits and pushes a badge from CI — [RISK]
`coverage.yaml` configures a git user and `git push` on every run. Roadmap Phase 2G explicitly targets removing unnecessary CI write operations.

### F-8. Workflow uses outdated actions and no permission hardening — [RISK]
`actions/checkout@v3`, `actions/setup-node@v3` (v4/v5 current); no `permissions:` block (defaults to write-all token in many repos); badge action pinned to a third-party `@v1.0.0`.

### F-9. Dependabot config file not recognized — [LIKELY] [PKG]
File is `.github/DEPENDABOT.yml` (uppercase). GitHub requires `.github/dependabot.yml` (lowercase); uppercase is silently ignored, so the documented monthly dependency updates likely never ran. Also `commit-message.include` is not a documented Dependabot key, and `target-branch: dependency-updates` requires that branch to exist. To be verified in Phase 2G before changing.

### F-10. Pipeline mode loses the buffered log on error — [RISK]
In pipeline mode, `deduper.flush()` runs only in the Transform's `_flush`, which Node does **not** call when the stream is destroyed after an error. `close(err, cb)` only clears the timer. An upstream error therefore silently discards the currently buffered log (and any unflushed repeats). Violates the "never silently discard a buffered log" principle; needs a Phase 1 fix + regression test (e.g., flush in `close` when error occurred, or document precisely).

### F-11. Backpressure ignored in both modes — [RISK]
`deduper.emit` → `dest.write(line)` / `transform.push(line)`; return values never checked. A slow downstream (file on slow disk, slow pretty-printer) lets the internal buffer grow without bound on high-volume input. SonicBoom has its own buffering, but unbounded growth under sustained pressure is a memory-growth vector (also listed in SECURITY.md scope).

### F-12. `await once(dest, 'close')` hang risk on `sync: true` — [LIKELY]
`close` hook: `dest.end(); await once(dest, 'close')`. If SonicBoom completes close synchronously (or errors without emitting `close`), the promise never resolves and the transport never finishes closing. Needs a Phase 1 test with `sync: true`, error injection, and a `once`-with-failure-guard.

### F-13. No validation of non-number / NaN / non-integer numerics — [RISK]
JS consumers bypass TS types. `maxRepeats: NaN` passes the `< 1` guard (all comparisons false → effectively disabled); `flushIntervalMs: NaN` reaches `setTimeout(..., NaN)` which Node coerces to fire immediately; `maxRepeats: 1.5` accepted; `countField: '__proto__'` or `''` accepted; `ignoreKeys: 'time'` (string, not array) accepted and spread into a char array. Phase 1A must add shape/type validation without breaking valid existing configs.

### F-14. Prototype-key edge cases — [RISK]
`getComparable` copies `Object.keys(obj)` into a fresh object; a `__proto__` own key (possible via `JSON.parse`) triggers `rest[key] = value` which sets the prototype of the temp object rather than an own property, changing deep-equal results. `flush()` writes `log[countField]` on the record itself — a `countField: '__proto__'` config would mutate the prototype of the emitted object. Contained (object is discarded / serialized), but equality semantics can be wrong. Phase 1B tests required.

### F-15. `onFlush` can mutate the record before serialization — [DOC] / behavior to pin
`onFlush(log, meta)` receives the exact object that is then `JSON.stringify`-ed. Hook mutations silently change output. Not a bug; must be documented and pinned by a test (or deliberately frozen in Phase 1C with compatibility analysis).

### F-16. Missing lifecycle test coverage — [TEST]
No tests exist for: destination `destroy()` mid-stream, destination/pipeline error paths, writes after destroy, multiple `end()`/close events, `sync: true`, backpressure, worker-thread serialization failures, `flushIntervalMs` behavior through a real stream close, or a real `pino()` integration (all current "transport" tests drive the factory directly with hand-written NDJSON — no Pino involvement). Phase 2A/B close this.

### F-17. CI runs no type-check, no build, no lint — [TEST]
`coverage.yaml` only runs `npm test`. CONTRIBUTING asks contributors to pass tsc/lint/build, but CI never enforces them.

### F-18. Timer ownership during worker teardown — [RISK] (low)
Timers are `.unref()`-ed, so they cannot keep a worker alive; in destination mode `close` flushes synchronously before teardown, so a pending timer firing concurrently with close is prevented by `clearTimer` ordering. Covered by Phase 1E lifecycle tests.

### F-19. `types.js` empty chunk and subpath exports — [PKG]
Only `.` is exported; `dist/deduper.js` etc. are unreachable but shipped. Harmless; relevant when fixing F-4.

### F-20. Lockfile version out of sync with manifest — [PKG] (pre-existing)
Working tree has uncommitted `package-lock.json` change syncing `1.0.0` → `1.0.1`. Should be committed as part of Phase 6 housekeeping (not this phase's scope).

### F-21. `prelint` mutates files — noted
`npm run lint` triggers `prelint` (`biome format --write`). Baseline used non-mutating `biome check` per roadmap instructions.

### F-22. No `import`/`default` export conditions also affect TS `moduleResolution: node16` ESM consumers — [CONFIRMED] (consequence of F-2)
TypeScript consumers with modern module resolution may fail to resolve the runtime entry for `import` mode. Re-test after F-2 fix.

### F-23. Approved feature has no implementation yet — status
`excludeLevels?: number[]` — not present anywhere in code/tests/docs. Scoped for Phase 3.

### Coverage of the 25 audit areas
1 Option validation → F-13 · 2 Numeric boundaries → F-13 · 3 NaN/Infinity → F-13 · 4 Object comparison → tested, strict mode solid · 5 Special keys → F-14 · 6 Prototype edges → F-14 · 7 Comparator failures → untested throwing comparator ([TEST], Phase 1C) · 8 Suffix formatter failures → untested throwing suffixFormat ([TEST], Phase 1C) · 9 onFlush errors → tested (caught → stderr) · 10 Timer behavior → tested with fake timers; lifecycle edges missing · 11 Buffer lifecycle → partially tested · 12 Destination errors → untested (F-16) · 13 Pipeline errors → untested, F-10 · 14 Stream destruction → untested (F-16) · 15 Graceful shutdown → tested for happy path · 16 Backpressure → F-11 · 17 High-volume input → untested (Phase 4 benchmark scope) · 18 Output serialization → valid NDJSON, regression-tested · 19 Memory growth → F-11 · 20 ESM exports → **F-2 confirmed** · 21 Worker compatibility → F-3 confirmed · 22 Node compatibility → F-1/F-6 · 23 npm contents → F-4/F-19/F-20 · 24 CI → F-5..F-9, F-17 · 25 Test coverage → 41 tests, 99.04% statements / 96.87% branches; gaps in F-16.

---

## 5. Baseline Verification Results

Environment: Node v24.20.0, npm 12.2.0, Linux x64, lockfile present (`package-lock.json`, v3).

| Command (exact) | Exit code | Result |
|---|---|---|
| `npm run tsc` | 0 | No type errors |
| `npm test` (`vitest run --coverage`) | 0 | **41 tests passed (4 files)**, 261 ms; coverage: statements 99.04%, branches 96.87%, functions 95.83%, lines 99.02%. Uncovered: `deduper.ts:83` (onFlush stack fallback), `index.ts:32` (destination error stderr handler). Only stderr noise: expected `pino-quiet: onFlush hook threw an error: Error: boom` from the throwing-hook test. No unhandled rejections or warnings. |
| `npm run build` (`prebuild`: tsc + clean → `tsup`) | 0 | ESM + DTS build success; 5 JS + 5 DTS files in `dist/` (see F-4) |
| `npx biome check ./src ./tests ./example` (non-mutating) | 0 | 11 files, no diagnostics, no fixes applied |

Reproductions performed (read-only, in `/tmp/pq-int-test` clean consumer project with `pino@10.4.0`, `pino-pretty`, local `pino-quiet` tarball-style link):

| Reproduction | Result |
|---|---|
| `pino({ transport: { target: 'pino-quiet' } })` + duplicates | Works: `{"msg":"a (x2)","repeats":2}` collapsed correctly |
| `import 'pino-quiet'` (ESM) | **Fails: `ERR_PACKAGE_PATH_NOT_EXPORTED`** (F-2) |
| `require('pino-quiet')` | Works (native require(esm)) |
| `comparator` via worker transport | **Fails: `could not be cloned`** (F-3) |
| Real pipeline: pino-quiet → pino-pretty via `pino.transport({ pipeline })` | Works: `dup (x2)` + `repeats: 2`, valid pretty output |

No pre-existing test failures. Baseline is fully green.

---

## 6. Approved Scope (from roadmap — restated for traceability)

- **Only new runtime feature:** `excludeLevels?: number[]` (Phase 3).
- **Approved engineering work:** real Pino integration tests; ESM export fix; worker-thread compatibility validation; Node/Pino compatibility matrix; reliable CI; benchmarks; VitePress docs.
- **Explicitly out of scope:** non-consecutive/LRU dedup, time-window grouping, matching presets, new integrations, any unapproved runtime behavior change.

## 7. Recommended Implementation Order (Phase 1 detail)

1. **Validation hardening** (F-13) — type/shape checks for all numeric and array options, preserving current valid configurations.
2. **Comparison safety** (F-14) — `__proto__`/special-key tests; pin equality semantics.
3. **Callback error policy** (F-15 + throwing comparator/suffixFormat tests) — define and test one predictable strategy; keep `onFlush` catch behavior.
4. **Pipeline error-path buffer preservation** (F-10) — regression test + minimal fix.
5. **Destination lifecycle** (F-12) — `sync: true`, destroy, repeated close, write-after-end tests; minimal fixes if hangs/leaks reproduce.
6. **Backpressure** (F-11) — measure first (Phase 4), only change if a real defect is demonstrated; otherwise document.

None of the above changes defaults or output shape; all are regression-safe for 1.0.x consumers.

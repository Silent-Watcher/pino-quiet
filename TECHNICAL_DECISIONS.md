# TECHNICAL_DECISIONS.md — pino-quiet

Each decision: context, choice, reasoning, alternatives rejected. New decisions are appended per phase; existing ones are final unless the roadmap owner approves a change.

---

## TD-1. Module format stays ESM-only (Phase 0)

**Context.** `package.json` has `"type": "module"`, tsup builds only `format: ['esm']`, and the `exports` map's `require` condition points at the ESM `dist/index.js`.

**Decision.** Keep ESM-only. No separate CJS build will be generated.

**Reasoning.** Verified on Node 24 that native `require(esm)` works: `require('pino-quiet')` loads the ESM file successfully because the declared engine floor (`>=v22.18.0`) is above the unflagged `require(esm)` threshold (Node 22.12+). A parallel CJS build would double the packaging surface for no consumer need.

**Alternatives rejected.**
- Ship CJS + ESM: maintenance cost, and no evidence any consumer requires CJS.
- Drop the `require` condition now: it currently provides a working interop path; removing it would be a backward-compatibility regression needing explicit SemVer evaluation (deferred to Phase 2D).

**Consequence carried forward.** The `require` condition is only valid because of `require(esm)`; it must be tested on every Node version the package claims to support (Phase 2F).

## TD-2. The `exports` map is broken for ESM importers; fix is additive (Phase 0 finding, fix in Phase 2)

**Context.** `exports['.']` lists only `require` and `types`. Reproduced: `import 'pino-quiet'` → `ERR_PACKAGE_PATH_NOT_EXPORTED` in a clean consumer. The documented flagship usage (`pino({ transport: { target: 'pino-quiet' } })`) works only because Pino resolves the target with `createRequire(...).resolve()` and thread-stream imports the absolute file URL, bypassing the exports map entirely.

**Decision.** Phase 2D adds `import` and `default` conditions pointing at the same ESM file. Treat as a bug fix (PATCH-qualifying), not an API change — the package's own TypeScript surface already documents a default export for importers.

**Alternatives rejected.**
- Keeping the map as-is and documenting "only use via Pino target": the package types export the factory; direct import is a reasonable expectation, and the fix is strictly additive.
- Adding a `main`-only fallback without `exports` modernization: weaker, keeps the footgun.

## TD-3. Callback options keep their direct-invocation role; worker limitation is documented, not engineered away (Phase 0 → Phase 2C/3)

**Context.** `comparator`, `suffixFormat`, `onFlush` cannot survive Structured Clone. Reproduced: passing `comparator` through `pino({ transport: { target: 'pino-quiet', options: { comparator } } })` throws `DOMException ... could not be cloned.`

**Decision.** Do not build serialization-based callback replacement (no stringified-function eval, no option-codec). Document precisely: callback options work when the factory is invoked directly (`build(pinoQuiet(options))`-style / custom worker loading a local module), and fail with `could not be cloned` when passed through standard Pino worker transport options. Every serialized-safe option (all plain-data options) works in both paths.

**Reasoning.** Roadmap forbids removing callback APIs and forbids unnecessary serialization machinery. The clone failure happens in Pino/thread-stream before pino-quiet code runs, so pino-quiet cannot improve the error either.

## TD-4. Repeat-count semantics: totals, not deltas — pinned as-is (Phase 0)

**Context.** `countField` and `FlushMeta.repeats` hold the **total occurrence count** of the batch (first log + repeats); `maxRepeats` caps total occurrences per batch; `minRepeatsToAnnotate` compares against the total. All three are consistent in code and tests.

**Decision.** Preserve. Document explicitly ("`repeats: 3` means the line occurred three times total") rather than reinterpret. Any change here would be a breaking change with no approved justification.

## TD-5. `levelAware` keeps its pre-comparator position (Phase 0)

**Context.** `isDuplicate` order: level check → `comparator` → `strict` → simple. The docs say `comparator` "completely overrides" built-in logic, but `levelAware: true` still filters before a custom comparator runs.

**Decision.** Preserve the runtime behavior (existing shipped behavior wins; changing the precedence would silently alter output for users combining `comparator` + `levelAware`). Correct the documentation in Phase 2/5 to state that `levelAware` gates every comparison mode including custom comparators.

## TD-6. Validation hardening may reject only never-valid configurations (Phase 1 policy)

**Context.** Three `RangeError` guards exist (`maxRepeats < 1`, `flushIntervalMs < 0`, `minRepeatsToAnnotate < 1`); everything else is unvalidated, and NaN currently passes the numeric guards.

**Decision.** Phase 1 adds type/shape validation that throws on values which were already broken (NaN, non-numbers, non-array `ignoreKeys`, empty string field names) while never rejecting a configuration that produced meaningful output before (e.g. `Infinity` for `maxRepeats` stays valid; `flushIntervalMs: 0` stays valid = disabled).

**Reasoning.** Rules forbid silently changing behavior, but throwing a clear error at construction for garbage input is a reliability improvement, and roadmap Phase 1A explicitly requests it.

## TD-7. Buffered-log safety: flush-before-drop is the invariant (Phase 0 → Phase 1)

**Context.** F-10: in pipeline mode a stream error path never runs the Transform's `_flush`, silently discarding the buffered log. Global rule: "Never silently discard a buffered log because of an internal failure."

**Decision.** Phase 1 makes the pipeline error path flush the pending buffer (or emit it before teardown), with a regression test that fails on the current code. Destination mode already flushes in `close` and is only missing lifecycle tests.

**Alternatives rejected.** Dropping the buffer on error "for consistency with Pino" — contradicts the project's explicit error-handling principle.

## TD-8. CI becomes a read-only quality gate (Phase 2G plan)

**Context.** Current workflow: Node 20 only, test-only, commits a badge back to the repo on every run, references a nonexistent `ci.yaml` badge, Dependabot config uses an unrecognized uppercase filename.

**Decision.** Replace with one workflow running tsc, Biome, unit + integration tests, build, and pack smoke tests on the supported Node matrix, with an explicit `permissions:` block and no push-back to the repository. Dependabot moves to lowercase `dependabot.yml` (validating the current file is truly ignored first). README badge updated to the real workflow name.

**Reasoning.** Roadmap Phase 2G lists each of these defects; CI-committed badges are flagged as unnecessary write operations.

## TD-9. Version stays 1.0.1 until Phase 6 (versioning policy)

**Context.** npm `latest` = 1.0.1; git tag exists only for v1.0.0; working tree has an uncommitted lockfile version-sync (`1.0.0` → `1.0.1`).

**Decision.** No `package.json` bump during Phases 1–5. All changes land under a CHANGELOG `Unreleased` heading with a provisional classification per phase (currently: fixes = PATCH-qualifying, `excludeLevels` = MINOR; projected final `1.1.0`). The lockfile sync is committed as housekeeping in Phase 6 alongside the single final bump. No publish, no tag, at any point — releases are manual.

## TD-10. Baseline is green; all Phase 1 changes are regression-guarded by the existing suite (Phase 0 result)

**Context.** `npm run tsc`, `npm test` (41 tests, 99.04% statements), `npm run build`, and non-mutating `npx biome check ./src ./tests ./example` all exit 0 on Node v24.20.0 / npm 12.2.0.

**Decision.** Treat the 41-test suite as the immovable baseline. Every Phase 1 defect fix must first add a failing regression test, then the minimal fix, then re-run the full suite. `npm run lint` is avoided during audit phases because its `prelint` hook mutates files (`biome format --write`).

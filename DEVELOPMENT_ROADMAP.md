# DEVELOPMENT_ROADMAP.md — pino-quiet

Status after Phase 0. Phase order is mandatory: 1 → 2 → 3 → 4 → 5 → 6. No phase starts without explicit approval of the previous one.

Version policy: `package.json` stays at `1.0.1` during development. All changes accumulate under a CHANGELOG `Unreleased` section; one final SemVer increment is calculated in Phase 6.

---

## Phase 1 — Core Reliability & Bug Fixes (next)

Source of truth: PROJECT_AUDIT.md §4 findings. Fixes existing behavior only; **no `excludeLevels`**.

| # | Work item | Audit ref | Type |
|---|---|---|---|
| 1.1 | Option validation: runtime types, integers, NaN/Infinity/absurd values, empty/conflicting field names, JS-consumer safety — without restricting currently valid configs | F-13 | Fix |
| 1.2 | Comparison safety: `__proto__` own-key behavior, special keys, nested objects/arrays, null/undefined `msg`, missing `msg` — pin semantics with tests | F-14 | Fix/tests |
| 1.3 | Callback error policy: throwing `comparator`, `suffixFormat`, `onFlush` — one predictable documented strategy each; keep `onFlush` catch-to-stderr behavior | F-15 | Policy/tests (+minimal fix if needed) |
| 1.4 | Pipeline error path must not silently discard the buffered log | F-10 | Fix + regression test |
| 1.5 | Destination lifecycle tests: `sync: true` close, destroy mid-stream, repeated close/end, write-after-end, destination error → stderr path | F-12, F-16 | Tests (+minimal fix if hang reproduces) |
| 1.6 | Backpressure: document; change only if Phase-4-grade evidence shows a defect | F-11 | Tests/docs |

Acceptance: all 41 baseline tests stay green, every confirmed defect has a regression test that failed before the fix, `tsc`/Biome/build pass, Unreleased changelog updated. Stop and report.

## Phase 2 — Pino Integration, ESM Package & CI

| # | Work item | Audit ref |
|---|---|---|
| 2.1 | Real `pino({ transport: { target: 'pino-quiet' } })` integration tests (init, dedup, distinct logs, final flush, shutdown, output format) | F-16 |
| 2.2 | Real pipeline test: pino-quiet → pino-pretty → writable; stage order, NDJSON validity, no duplicate emissions, error propagation | F-16 |
| 2.3 | Worker serialization matrix: every public option; callback options via direct factory vs worker; exact error messages documented (`could not be cloned`) | F-3 |
| 2.4 | ESM exports fix: add `import` + `default` conditions (keep `require(esm)` interop, no CJS build); SemVer evaluation of the interop path | F-2, F-22 |
| 2.5 | Node minimum reconciliation (source APIs vs `engines` vs README/CHANGELOG); Pino 9/10 compatibility matrix — only claim what integration tests prove | F-1, F-6 |
| 2.6 | `npm pack --dry-run` + clean-consumer smoke tests (ESM import, transport discovery, destination, pipeline, declarations, `require(esm)` on all claimed Node versions) | F-4, F-19 |
| 2.7 | CI quality workflow: tsc + Biome + tests + build + pack smoke (+ docs build after Phase 5); supported Node matrix; fix badge path (F-5), Dependabot filename/key/branch issues (F-9), remove CI badge-commit writes (F-7), action versions + `permissions:` (F-6, F-8) | F-5..F-9, F-17 |

Acceptance: clean consumer project installs and uses the package; all integration tests pass; CI gate green. Stop and report.

## Phase 3 — `excludeLevels` Feature (only approved runtime feature)

`excludeLevels?: number[]` — bypass deduplication for selected numeric Pino levels (e.g. `[50]`).

Implementation contract (from roadmap):
- Optional; default preserves existing behavior exactly.
- Works in destination mode, pipeline mode, and via serialized worker options (arrays clone fine).
- Excluded records are never buffered/annotated; emitted immediately in order; pending buffer flushed first; excluded records do not touch repeat counters; next normal log starts a new batch.
- Validates array type and numeric values; documented behavior for records without a numeric `level`.
- Coexists with `strict`, `levelAware`, `comparator`, `caseInsensitive`; comparison precedence unchanged.
- Tests: omitted option, empty array, single/multiple levels, custom levels, consecutive excluded, buffer-before-exclusion, strict/levelAware interaction, destination, pipeline, real worker transport.
- Docs: TS comments, README, CHANGELOG Unreleased; VitePress in Phase 5.

Acceptance: purely additive; no behavior change without the option. Provisional SemVer: **MINOR** (with Phase 1 fixes, cumulative release likely MINOR; Phase 6 decides finally). Stop and report.

## Phase 4 — Performance Benchmarking

Scenarios per roadmap (13 cases: plain Pino baseline, no-dup / full-dup / partial-dup workloads, simple vs strict, custom comparator, small/large metadata, flush intervals, high volume, destination vs pipeline). Deterministic datasets; document machine, Node, Pino versions; no timing assertions in unit tests.

Optimization policy: baseline → bottleneck evidence → behavior-preserving change → re-test → re-measure. No change without demonstrated value; simpler implementation wins ties. Benchmark tooling stays dev-only.

## Phase 5 — VitePress Documentation Website

Structure, content, and requirements per roadmap Part 3 Phase 5 (guide / api / recipes / troubleshooting / migration / contributing; local search; default theme; version read from package metadata; scripts `docs:dev/build/preview`; GitHub Pages deployment workflow with correct base path, branch guard, permissions, build/deploy job separation; README slimmed to quick start + docs link; CI validates docs build).

Do not document unsupported combinations (esp. callback options via worker transport — Phase 2C matrix feeds this).

## Phase 6 — Final QA & Release Readiness

Full suite run (unit, integration, real-Pino, destination, pipeline, tsc, Biome, build, npm packaging, Node matrix, docs build). Backward-compatibility audit against the Phase 0 baseline table in PROJECT_AUDIT.md §3. Package + docs consistency audit. Final SemVer decision (expected MINOR if only fixes + `excludeLevels`; MAJOR only if a real breaking change is confirmed). Commit `package-lock.json` version-sync housekeeping (F-20). No npm publish, no git tag. Final release report with READY / READY AFTER MINOR MANUAL ACTIONS / NOT READY.

---

## Versioning Ledger (provisional)

| Phase | Change type | Provisional SemVer impact |
|---|---|---|
| 1 | Validation + reliability fixes (backward-compatible) | PATCH-qualifying |
| 2 | ESM exports fix (makes documented usage work), CI, tests | PATCH-qualifying (bug fix) |
| 3 | New opt-in option `excludeLevels` | **MINOR** |
| 4 | Benchmark tooling (dev-only) | none |
| 5 | Docs website (dev-only) | none |
| 6 | Final calculation | likely **1.1.0** (MINOR) |

Critical rule check: the 1.0.0 CHANGELOG claimed "Node >= 18 required" as a breaking change but `engines` still says `>=v22.18.0`; if Phase 2 reconciles this by raising the documented minimum back to 22, that is a packaging/docs correction (no MAJOR). If lowering the engine floor to the actually-supported version, also non-breaking. Phase 2E documents the decision.

# Benchmarks

Phase 4 engineering tool (dev-only, never shipped in the package).

## Running

```sh
npm run build          # benchmarks import dist/
node scripts/benchmark.mjs [totalLines]   # default: 100000
```

Every scenario runs in a fresh child process, `REPEAT` times, median reported. Datasets are deterministic (seeded construction, no randomness at runtime). Machine-readable JSON results are written to `bench/results/` (gitignored — machine-specific).

Do not compare numbers across machines; only before/after runs on the same machine count.

## Scenarios

Worker-based end-to-end scenarios use real `pino.transport()` worker threads fed structured objects (as real callers do). Comparison-mode scenarios run a Deduper-level microbenchmark, because driving a direct-mode transport synchronously floods Pino's `split2` input stream (~6s per 100k lines, upstream behavior shared by every transport) and drowns the signal. The microbenchmark measures pino-quiet's own comparison cost with the stream bypassed.

Datasets (all deterministic): `allUnique` (1000 distinct messages, no consecutive duplicates), `consecutiveRuns` (100 distinct messages × 10 identical repetitions = 90% consecutive duplicates), `oneUnique` (1 message repeated), `smallMeta`/`largeMeta` (with a ~1KB payload).

## Results

Machine: 16 cores, x64, linux (kernel 5.15), Node v24.20.0, pino 10.4.0, 2026-11-03, seed 42, 100k lines/scenario, 3 repetitions. Raw JSON: `bench/results/bench-2026-11-03T06-47-59-911Z.json`.

| Scenario | Throughput | Output reduction |
|---|---|---|
| 01 baseline: standard pino (pino/file) | 257,568 logs/s | — |
| 02 quiet, all unique (no duplicates) | 251,176 logs/s | 0% (pass-through, byte-identical volume) |
| 03 quiet, fully repeated (1 unique msg) | 280,837 logs/s | 99.999% (113 B of 8.5 MB) |
| 04 quiet, partially repeated (90% consecutive dups) | 265,863 logs/s | 87.8% |
| 05 quiet, strict comparison, all unique | 255,936 logs/s | 0% |
| 06 quiet, strict comparison, fully repeated | 257,535 logs/s | 99.999% |
| 07 microbench, simple comparison | 1,148,993 logs/s | — |
| 08 microbench, strict comparison | 635,714 logs/s | — |
| 09 microbench, custom comparator | 1,220,182 logs/s | — |
| 10 quiet, small metadata objects (strict) | 248,922 logs/s | 0% |
| 11 quiet, large metadata objects ~1KB (strict) | 138,005 logs/s | 0% |
| 12 quiet, default flushIntervalMs (5000ms) | 258,214 logs/s | 0% |
| 13 quiet, high volume (1M lines) | 247,581 logs/s | 0% |
| 14 quiet, pipeline mode (quiet → pino/file) | 286,213 logs/s | 87.8% |

## Findings

1. **No added overhead in real (worker) usage.** With no duplicates to collapse (02), pino-quiet matches the standard-pino baseline within run-to-run noise (−2.5%). With duplicates present it is as fast or faster (03, 04, 06, 14) because it writes fewer bytes downstream.
2. **Strict comparison costs ~1.8x at the micro level** (08 vs 07: `getComparable` allocations + `fast-deep-equal`), but the cost is invisible end-to-end (05/06 ≈ 02) because worker-thread IPC and JSON serialization dominate. Per the optimization policy: no runtime change justified — the simpler implementation stays.
3. **Throughput scales linearly** at 1M lines (13), no memory-growth blowup attributable to the deduper; heap growth tracked the queued output volume.
4. **Large payloads dominate** (11: 138k logs/s with 1KB payloads — JSON serialization, not comparison, is the cost).
5. **Upstream note:** a synchronous flood of writes into any `pino-abstract-transport` stream is limited by `split2` + async iteration (measured ~16k lines/s), independent of pino-quiet. Worker transports are not affected (lines arrive over the worker message port).

Re-run before/after any performance-motivated change and attach both JSON files.

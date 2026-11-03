# Performance

`pino-quiet` adds no measurable overhead in real usage. See [`bench/README.md`](https://github.com/Silent-Watcher/pino-quiet/blob/master/bench/README.md) for the full benchmark harness and results.

## Headline numbers

Measured on Node v24, pino 10, 100k lines per scenario, median of 3 runs:

| Scenario | Throughput | Output reduction |
| --- | --- | --- |
| Standard pino (pino/file) | 257,568 logs/s | — |
| Quiet, no duplicates | 251,176 logs/s | 0% |
| Quiet, fully repeated | 280,837 logs/s | 99.999% |
| Quiet, 90% consecutive dups | 265,863 logs/s | 87.8% |
| Quiet, strict comparison | 255,936 logs/s | 0% |

## Interpretation

- **No overhead:** with no duplicates to collapse, pino-quiet matches the standard-pino baseline within run-to-run noise. With duplicates it is as fast or faster, because it writes fewer bytes downstream.
- **Strict comparison is ~1.8x slower at the micro level** (allocations + deep equality), but the cost is invisible end-to-end because worker-thread IPC and JSON serialization dominate. No runtime optimization was justified — the simpler implementation stays.
- **Throughput scales linearly** to 1M lines per scenario.
- **Large payloads dominate:** 1KB records drop to ~138k logs/s because JSON serialization is the cost, not comparison.

## When to worry

- pino-quiet does not apply backpressure. A destination that stays slower than your log volume accumulates data in SonicBoom's memory buffer. See [Limitations](/guide/limitations).
- Synchronous direct-mode writes flood Pino's `split2` input stream (~16k lines/s upstream), independent of pino-quiet. Worker transports are unaffected.
- `sync: true` writes each line to disk synchronously and is inherently slower.
- Very large records (>10KB) push serialization cost up linearly.

## Benchmarking your own workload

```sh
npm run build
node scripts/benchmark.mjs 100000
```

Deterministic datasets, machine-readable JSON in `bench/results/`. Compare only before/after runs on the same machine.
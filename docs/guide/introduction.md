# Introduction

`pino-quiet` is a [Pino](https://getpino.io) transport that **reduces log noise** by collapsing repeated consecutive log messages into a single entry with a repetition counter.

```
{"level":30,"msg":"Connecting..."}     ┐
{"level":30,"msg":"Connecting..."}     ├──▶  {"level":30,"msg":"Connecting... (x3)","repeats":3}
{"level":30,"msg":"Connecting..."}     ┘
{"level":30,"msg":"Connected!"}        ──▶  {"level":30,"msg":"Connected!"}
```

## Why

Repeating log lines are the most common form of log noise: retry loops, polling, reconnection storms, hot request paths. They cost storage, ingestion money, and attention. `pino-quiet` collapses them at the transport layer — your application code never changes.

## What it does

- Buffers the most recent log and counts consecutive duplicates.
- Emits the buffered log (annotated with its total count) when a different log arrives, when the batch hits `maxRepeats`, after `flushIntervalMs` of silence, or on shutdown.
- Optionally adds first/last-seen timestamps and calls an `onFlush` hook for metrics.
- Emits exactly one record per batch of consecutive duplicates: the **first** record of the batch, annotated with the total count. A batch that is still pending is always flushed on shutdown.

## What it does not do

- It does not deduplicate **non-consecutive** messages (only runs of identical consecutive records).
- It does not store, aggregate, or ship logs anywhere — it only collapses and forwards.
- It does not alter levels, timestamps, or any field other than the configured count/timestamp fields (and `msg` when annotation is enabled) — unless your own `onFlush` hook does.

## Where to go next

- [Quick start](/guide/quick-start) for the shortest path to working output
- [How it works](/guide/how-it-works), [Batching & flushing](/guide/flushing), and [Limitations](/guide/limitations) to understand the behavior
- [Options](/api/options) for the full reference

::: tip Documentation tracks `master`
Features marked *Unreleased* (for example `excludeLevels`) are not in the latest npm release yet. See the [changelog](https://github.com/Silent-Watcher/pino-quiet/blob/master/CHANGELOG.md).
:::

## Requirements

- Node.js >= 20
- Pino ^9 || ^10

# How it works

`pino-quiet` sits between Pino and your destination. It processes every parsed log record through a small state machine called the **Deduper**.

## The pipeline

```
Pino → worker thread → pino-quiet → [Deduper: compare → buffer → flush] → destination or next stage
```

1. Pino hands each parsed log record to the transport.
2. The record is compared against the currently buffered one using the active [comparison mode](/guide/comparison-modes).
3. **Match:** the internal counter increments and nothing is written yet.
4. **No match:** the buffered batch is flushed (annotated with its final count) and the new record takes its place in the buffer.
5. On shutdown, whatever is still buffered is flushed — no log is ever lost.

## When a batch flushes

A buffered batch is flushed when any of these happens:

| Trigger | Controlled by |
| --- | --- |
| A different log arrives | always |
| The batch reaches the cap | `maxRepeats` |
| The batch sits idle | `flushIntervalMs` |
| The stream shuts down normally | always |
| The transport is destroyed or errors | always — the pending log goes to the destination, or to `stderr` if the downstream is already gone |

## What a flush emits

- If the batch repeated and `annotateMessage` is `true`, `msg` gets a suffix (`" (x3)"` by default, customizable via `suffixFormat`).
- If the batch repeated, the total occurrence count is written to `countField` (`repeats` by default) — unless `minRepeatsToAnnotate` says the batch is too small to annotate.
- If `includeTimestamps` is `true`, `firstSeen` and `lastSeen` epoch-ms fields are added to **every** flushed record.
- The `onFlush` hook (if set) is called right before the record is written.

The record is then serialized to NDJSON and written to the destination or pushed to the next pipeline stage.

## Resource safety

- The flush timer is unref'd and cleared on every state change and on teardown.
- Destination errors are reported on `stderr` instead of crashing the process.
- A destroyed or errored pipeline never silently discards the buffered log — it is emitted to `stderr` when downstream delivery is no longer possible.
- Excluded levels ([`excludeLevels`](/guide/excluded-levels)) bypass this machinery entirely and are written straight through.

## Repeat-count semantics

`repeats` (and `FlushMeta.repeats`) is the **total number of occurrences** in the batch, including the first. Three identical logs produce `repeats: 3`, not `repeats: 2`. `maxRepeats` caps the same total, and `minRepeatsToAnnotate` compares against it.

# Output format

Each batch of consecutive duplicates is written as **one NDJSON line**: the first record of the batch, plus the fields pino-quiet adds. The examples below use `flushIntervalMs: 0` so timing does not matter.

## A single record

A record that was not repeated is written untouched:

```json
{"level":30,"time":1000,"msg":"Connected!"}
```

## A collapsed batch

Three records with the same `msg`:

```json
{"level":30,"time":1000,"requestId":1,"msg":"Request processed"}
{"level":30,"time":2000,"requestId":2,"msg":"Request processed"}
{"level":30,"time":3000,"requestId":3,"msg":"Request processed"}
```

are written as:

```json
{"level":30,"time":1000,"requestId":1,"msg":"Request processed (x3)","repeats":3}
```

- Every field comes from the **first** record of the batch (`time`, `requestId`, and so on). Metadata of the later duplicates is discarded.
- `msg` is rewritten in place with the suffix (see `annotateMessage`, `suffixFormat`).
- The count field (`repeats` by default) is appended last and holds the **total** number of occurrences, including the first.

## What each option changes

| Option | Effect on the emitted line |
| --- | --- |
| `countField` | Renames the count field (`"count":3` instead of `"repeats":3`). |
| `annotateMessage: false` | `msg` is left untouched; only the count field is set. |
| `suffixFormat` | Replaces the `" (x3)"` suffix. |
| `minRepeatsToAnnotate` | Batches smaller than this are written without suffix **and without count field**. |
| `includeTimestamps` | Adds `firstSeen` / `lastSeen` (epoch ms) to **every** emitted line, including single records. |
| `firstSeenField` / `lastSeenField` | Rename the timestamp fields. |
| `onFlush` | Receives the exact object that is serialized; changes it makes appear in the output. |

## Examples

`annotateMessage: false` with `includeTimestamps: true` (timestamp values are illustrative):

```json
{"level":30,"msg":"a","repeats":2,"firstSeen":1700000000000,"lastSeen":1700000000450}
{"level":30,"msg":"z","firstSeen":1700000000600,"lastSeen":1700000000600}
```

`minRepeatsToAnnotate: 3` with a batch of two `a` followed by a batch of three `b`:

```json
{"level":30,"msg":"a"}
{"level":30,"msg":"b (x3)","repeats":3}
```

::: warning
The second `a` above is gone and nothing in the output says it existed. See [Limitations](/guide/limitations#min-repeats-hides-counts).
:::

If `msg` is not a string, the count field is still set but no suffix can be added:

```json
{"level":30,"msg":42,"repeats":2}
```

## Timestamps

`firstSeen`, `lastSeen`, and `meta.firstSeen` / `meta.lastSeen` in `onFlush` are the moments pino-quiet **received** the records (`Date.now()` inside the transport). They are not the `time` field written by Pino, which comes from the first record of the batch.

## Guarantees

- One JSON object per line, no stray characters (this was a bug before 1.0.0).
- Original field order is kept; only the count and timestamp fields are appended.

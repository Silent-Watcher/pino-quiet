# Batching & flushing

A **batch** is a run of consecutive duplicate records. pino-quiet holds one batch in memory and writes it when the batch *ends*.

## When a batch ends

| Trigger | Controlled by |
| --- | --- |
| A different record arrives | always |
| The batch reaches the cap | `maxRepeats` |
| No record arrives for a while | `flushIntervalMs` |
| An [excluded level](/guide/excluded-levels) arrives | `excludeLevels` |
| The transport shuts down | always, see [Shutdown & durability](/guide/shutdown) |

After a batch ends, the next record starts a **new** batch, even if it is identical to the one just written.

## The idle timer (`flushIntervalMs`)

`flushIntervalMs` is an **idle** timer. It is re-armed by every incoming record, duplicates included. It only fires when nothing at all arrives for that long.

With `flushIntervalMs: 300` and a duplicate arriving every 150 ms for about a second, nothing is written until the stream goes quiet:

```
   0 ms   tick   ┐
 150 ms   tick   │  timer reset on every duplicate
 ...             │
1050 ms   tick   ┘
1350 ms   {"msg":"tick (x8)","repeats":8}   ← 300 ms after the last duplicate
```

Consequences:

- A steady stream of duplicates that always arrives faster than the interval is **never** flushed by the timer. Use `maxRepeats` to bound it.
- If the same message resumes after a timer flush, it starts a new batch, so one message can appear as `tick (x8)` and later `tick (x2)`.
- `0` disables the timer. The default is `5000`.

## The cap (`maxRepeats`)

`maxRepeats: N` flushes as soon as a batch reaches `N` total occurrences, without waiting for a different record. Seven identical records with `maxRepeats: 3`:

```json
{"level":30,"msg":"x (x3)","repeats":3}
{"level":30,"msg":"x (x3)","repeats":3}
{"level":30,"msg":"x"}
```

The check happens when a duplicate arrives, so a batch never has fewer than 2 occurrences. `maxRepeats: 1` and `maxRepeats: 2` behave identically (batches of 2).

## Choosing values

| Situation | Suggested options |
| --- | --- |
| Default, interactive development | defaults (`flushIntervalMs: 5000`) |
| Low traffic, you want timely counts | `flushIntervalMs: 1000` |
| Hot loops or retry storms | `maxRepeats: 500, flushIntervalMs: 1000` |
| Deterministic tests | `flushIntervalMs: 0`, and flush on shutdown |
| Last log must survive a hard kill | `excludeLevels: [50, 60]` and a small `flushIntervalMs` |

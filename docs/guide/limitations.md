# Limitations

pino-quiet is deliberately simple. These are the behaviors that surprise people most.

## Only consecutive duplicates collapse

Records must be neighbors:

```
A, A, A, B   →  A (x3), B
A, B, A, B   →  A, B, A, B      (nothing collapses)
```

There is one buffer per transport instance. Concurrent work that interleaves its logs (several requests logging at once, many child loggers sharing one logger) can keep identical messages from ever being adjacent.

## The first record wins

Metadata of later duplicates is discarded. In the default mode, `requestId: 1`, `2`, and `3` with the same `msg` become one record with `requestId: 1`. Use [`strict`](/guide/comparison-modes) if the metadata must be preserved; records with different metadata are then not duplicates.

## Records without `msg` collapse in simple mode {#no-msg}

In the default (simple) mode, two records that both lack a `msg` are considered duplicates, whatever else they contain:

```js
logger.info({ userId: 1 });
logger.info({ userId: 2 });
logger.info({ userId: 3 });
```

is written as a single line:

```json
{"level":30,"userId":1,"repeats":3}
```

`userId` 2 and 3 are lost. If you log objects without a message, use `strict: true` or a `comparator`.

## `minRepeatsToAnnotate` hides counts {#min-repeats-hides-counts}

`minRepeatsToAnnotate` only controls annotation, not collapsing. Below the threshold the extra duplicates are still dropped, and no count is written. Leave it at `1` unless you do not need to know about small batches.

## Callback options and workers

`comparator`, `suffixFormat`, and `onFlush` cannot be passed through `transport.target`. See [Pino integration & workers](/guide/pino-integration).

## Independent state per transport

Each transport instance (each Pino worker, each entry in a `pipeline`) has its own buffer. Several processes writing to one file are not coordinated.

## Numeric levels

[`excludeLevels`](/guide/excluded-levels) matches the numeric `level` exactly. If `level` reaches pino-quiet as a string label, it never matches and the record is deduplicated normally.

## No backpressure handling

pino-quiet writes to its destination (or pushes to the next stream) without checking whether it accepted the data. If the destination is slower than your log volume, SonicBoom buffers the difference in memory. The [benchmarks](/recipes/performance) up to 1M lines showed no growth attributable to pino-quiet, but a persistently slow destination is not protected against.

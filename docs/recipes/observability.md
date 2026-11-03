# Observability

`pino-quiet` exposes collapse events through the `onFlush` hook. The hook runs synchronously right before a (possibly collapsed) record is written, so it can feed metrics without blocking the log path.

## Hook signature

```ts
type FlushMeta = {
  repeats: number; // total occurrences in the batch (1 = never duplicated)
  firstSeen: number; // epoch ms of the first occurrence
  lastSeen: number; // epoch ms of the most recent occurrence
};

options: {
  onFlush: (log: LogRecord, meta: FlushMeta) => void;
}
```

## Histogram of repeat counts

```ts
options: {
  onFlush: (_log, meta) => {
    metrics.histogram('log.repeats', meta.repeats);
  },
}
```

## Rate of collapsed bytes

```ts
options: {
  onFlush: (log, meta) => {
    if (meta.repeats > 1) {
      metrics.counter('log.collapsed.bytes', JSON.stringify(log).length);
    }
  },
}
```

## Hook safety

The hook is called inside the flush path. Errors it throws are caught and reported to `stderr`; the record is still emitted. The hook must not block for long — it runs on the same event loop tick as the write.

## Direct invocation only

`onFlush` is a function and cannot survive Pino's worker-thread serialization. See [Pino integration & workers](/guide/pino-integration).
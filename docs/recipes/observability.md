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

## Approximate bytes saved

```ts
options: {
  onFlush: (log, meta) => {
    if (meta.repeats > 1) {
      const lineBytes = Buffer.byteLength(JSON.stringify(log));
      metrics.counter('log.bytes.saved', lineBytes * (meta.repeats - 1));
    }
  },
}
```

## Alert on a noisy loop

```ts
options: {
  onFlush: (log, meta) => {
    if (meta.repeats >= 1000) {
      alerts.notify(`log repeated ${meta.repeats} times: ${log.msg}`);
    }
  },
}
```

## What the hook receives

- It runs for every flushed record. `meta.repeats` is `1` for a record that never repeated.
- It does not run for records of an [excluded level](/guide/excluded-levels).
- `log` is the exact object that is written next. Changes you make to it (adding, editing, or deleting fields) appear in the output.

## Hook safety

The hook is called inside the flush path. Errors it throws are caught and reported to `stderr`; the record is still emitted. The hook must not block for long — it runs on the same event loop tick as the write.

## Direct invocation only

`onFlush` is a function and cannot survive Pino's worker-thread serialization. See [Pino integration & workers](/guide/pino-integration).
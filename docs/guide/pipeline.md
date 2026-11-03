# Pipeline mode

By default (`pipeline` not set), pino-quiet is a **terminal** transport: it owns its destination and writes directly to it. Set `pipeline: true` to turn it into a pass-through stage instead, so it can sit *before* other transports in a `pino.transport({ pipeline: [...] })` chain.

## Composing with pino-pretty

```ts
import pino from 'pino';

const logger = pino({
  transport: {
    pipeline: [
      {
        target: 'pino-quiet',
        options: { pipeline: true, flushIntervalMs: 2000 },
      },
      {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    ],
  },
});
```

pino-quiet collapses repeats first, then hands the (fewer) NDJSON lines to pino-pretty for formatting. This works with any transport that can be a pipeline stage, not just pino-pretty — for example forwarding the collapsed stream to a log shipper.

## Destination rules

`destination`, `mkdir`, `append`, and `sync` are ignored in pipeline mode — the **last** stage in the pipeline owns the actual destination.

## Stage order

The deduplication happens wherever pino-quiet sits in the chain. Placing it first means downstream stages receive fewer records and do less work; records arrive at downstream stages as valid NDJSON with the `repeats` field set.

## Reliability guarantees

- Normal end: the final buffered record is flushed through the pipeline (the stream's `flush` hook).
- Error or destroy: the pending record is flushed to the downstream stage if it is still alive, otherwise it is written to `stderr` — it is never silently dropped.
- Output stays valid NDJSON: one JSON object per line, no stray characters.

## Runnable example

See [`example/pipeline-with-pino-pretty.ts`](https://github.com/Silent-Watcher/pino-quiet/blob/master/example/pipeline-with-pino-pretty.ts) in the repository.

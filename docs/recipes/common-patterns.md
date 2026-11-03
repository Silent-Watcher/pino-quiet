# Common patterns

## Never collapse errors with info logs that share text

```ts
options: { levelAware: true }
```

## Deduplicate ignoring a request-scoped field

```ts
options: { strict: true, ignoreKeys: ['requestId', 'traceId'] }
```

## Track collapse events in your own metrics

```ts
options: {
  onFlush: (log, meta) => {
    metrics.histogram('log.repeats', meta.repeats);
  },
}
```

## Cap runaway hot loops

```ts
options: { maxRepeats: 500, flushIntervalMs: 1000 }
```

## Never collapse errors — let them through one by one

```ts
options: { excludeLevels: [50] }
```

## Write to a file, appending

```ts
options: { destination: './app.log', append: true, mkdir: true }
```

## Add first/last-seen timestamps to collapsed batches

```ts
options: { includeTimestamps: true }
```

## Leave `msg` untouched, only set the count field

```ts
options: { annotateMessage: false }
```

## Custom suffix

```ts
options: { suffixFormat: (count) => ` [seen ${count}x]` }
```

## Rename the count field

```ts
options: { countField: 'count' }
// {"msg":"a (x2)","count":2}
```

## Pretty in development, JSON in production

```ts
const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  transport: isDev
    ? {
        pipeline: [
          { target: 'pino-quiet', options: { pipeline: true } },
          { target: 'pino-pretty', options: { ignore: 'pid,hostname,repeats' } },
        ],
      }
    : { target: 'pino-quiet' },
});
```

## Collapse only specific noisy messages

Direct factory invocation only:

```ts
const noisy = new Set(['Connecting...', 'Retrying']);

const transport = await pinoQuiet({
  comparator: (previous, current) =>
    noisy.has(current.msg) && previous.msg === current.msg,
});
const logger = pino(transport);
```

## Collapse by error code

```ts
const transport = await pinoQuiet({
  comparator: (previous, current) =>
    previous.code !== undefined && previous.code === current.code,
});
```

## Do not lose errors on a hard kill

```ts
options: { excludeLevels: [50, 60], flushIntervalMs: 1000 }
```

See [Shutdown & durability](/guide/shutdown).

## Hide the count field in pino-pretty

```ts
{ target: 'pino-pretty', options: { ignore: 'pid,hostname,repeats' } }
```

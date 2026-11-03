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
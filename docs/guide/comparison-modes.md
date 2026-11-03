# Comparison modes

`pino-quiet` decides whether a new record repeats the buffered one using, in order:

1. **`levelAware` gate** — when `levelAware: true`, records with different `level` values are never duplicates. This check runs first, before everything else — including a custom comparator.
2. **`comparator`** — when set, its return value decides. It receives the two raw, unmodified records. Errors it throws are caught and reported to `stderr`, and the record is treated as *not* a duplicate (flushing the pending batch), so a buggy comparator cannot crash the logging pipeline.
3. **`strict` deep comparison** — when `strict: true`, the entire record objects are compared with deep equality, excluding the volatile fields `time`, `pid`, `hostname` plus any extra `ignoreKeys`.
4. **Simple comparison** (default) — only the `msg` string is compared. When `msg` is missing or not a string on either side, deep equality of the `msg` values is used instead. `caseInsensitive: true` lowercases both sides first (simple mode only).

## Simple (default)

Fastest mode. Two records are duplicates when their `msg` strings are equal — metadata differences are ignored:

```ts
options: { strict: false } // default
```

```js
logger.info({ requestId: 1 }, 'Request processed');
logger.info({ requestId: 2 }, 'Request processed');
// → collapses to one "Request processed (x2)" record
```

## Strict

Compares the whole record minus volatile fields. Use it when the metadata matters:

```ts
options: { strict: true }
```

```js
logger.error({ id: 1 }, 'Transaction failed');
logger.error({ id: 1 }, 'Transaction failed'); // same id → collapses
logger.error({ id: 2 }, 'Transaction failed'); // different id → new batch
```

`ignoreKeys` adds fields to the built-in exclusion list (`time`, `pid`, `hostname`) — the lists are **merged**, never replaced:

```ts
options: { strict: true, ignoreKeys: ['requestId', 'traceId'] }
```

## Custom comparator

Complete control, direct factory invocation only (see [Pino integration & workers](/guide/pino-integration)):

```ts
options: {
  comparator: (previous, current) => previous.code === current.code,
}
```

## Level awareness

Prevents an `info` and an `error` that share text from collapsing together:

```ts
options: { levelAware: true }
```

# Comparison modes

`pino-quiet` decides whether a new record repeats the buffered one using, in order:

1. **`levelAware` gate** — when `levelAware: true`, records with different `level` values are never duplicates. This check runs first, before everything else — including a custom comparator.
2. **`comparator`** — when set, its return value decides. It receives the two raw, unmodified records. Errors it throws are caught and reported to `stderr`, and the record is treated as *not* a duplicate (flushing the pending batch), so a buggy comparator cannot crash the logging pipeline.
3. **`strict` deep comparison** — when `strict: true`, the entire record objects are compared with deep equality, excluding the volatile fields `time`, `pid`, `hostname` plus any extra `ignoreKeys`.
4. **Simple comparison** (default) — only the `msg` string is compared. When `msg` is missing or not a string on either side, deep equality of the `msg` values is used instead. `caseInsensitive: true` lowercases both sides first (simple mode only).

Records of an [excluded level](/guide/excluded-levels) skip comparison entirely.

## Simple (default)

Fastest mode. Two records are duplicates when their `msg` strings are equal — metadata differences are ignored:

```ts
options: { strict: false } // default
```

```js
logger.info({ requestId: 1 }, 'Request processed');
logger.info({ requestId: 2 }, 'Request processed');
// → {"requestId":1,"msg":"Request processed (x2)","repeats":2}
```

The emitted record is the **first** one, so `requestId: 2` is not kept. See [Output format](/guide/output-format).

::: warning Records without `msg`
In simple mode, two records that both lack `msg` are treated as duplicates whatever else they contain, so `logger.info({ userId: 1 })` followed by `logger.info({ userId: 2 })` collapse and `userId: 2` is lost. Use `strict: true` or a `comparator` for such logs. See [Limitations](/guide/limitations#no-msg).
:::

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

## Case-insensitive messages

```ts
options: { caseInsensitive: true } // simple mode only
```

`"Retrying"` and `"retrying"` collapse. The option has no effect with `strict` or a `comparator`.

## Custom comparator

Complete control, direct factory invocation only (see [Pino integration & workers](/guide/pino-integration)):

```ts
options: {
  comparator: (previous, current) => previous.code === current.code,
}
```

Things to know:

- `previous` is always the **first** record of the pending batch, not the most recent duplicate.
- The comparator is not called when nothing is buffered, nor for excluded levels.
- It can return `false` to opt specific records out of collapsing. This collapses only chosen messages:

```ts
const noisy = new Set(['Connecting...']);

options: {
  comparator: (previous, current) =>
    noisy.has(current.msg) && previous.msg === current.msg,
}
```

`Connecting...` repeats collapse into `Connecting... (x2)`, while other messages pass through one by one.

## Level awareness

Prevents an `info` and an `error` that share text from collapsing together:

```ts
options: { levelAware: true }
```

The gate also applies when a `comparator` is set: with `levelAware: true`, records at different levels are never duplicates, even if the comparator always returns `true`.

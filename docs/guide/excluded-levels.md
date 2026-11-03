# Excluded levels

`excludeLevels: number[]` marks numeric Pino levels that **bypass deduplication entirely**.

```ts
const logger = pino({
  transport: {
    target: 'pino-quiet',
    options: { excludeLevels: [50] }, // 50 is the standard Pino error level
  },
});
```

## Behavior

For this input with `excludeLevels: [50]`:

- info: Database connection failed
- info: Database connection failed
- error: Critical database error
- error: Critical database error
- info: Database connection failed

The output is:

- info: Database connection failed (x2)
- error: Critical database error
- error: Critical database error
- info: Database connection failed

Excluded records:

- are emitted immediately, in order, completely untouched — no annotation, no count field, no timestamps, never passed to `onFlush`;
- never touch the repeat counter of normal batches;
- break the current batch: any pending buffered log is flushed first, and the next non-excluded record starts a fresh batch;
- work identically in destination mode, pipeline mode, and serialized worker options (arrays are serializable).

## Level matching

Levels are matched by strict numeric equality against the record's `level` field. Custom numeric levels work (e.g. `[35, 50]`). A record **without a numeric `level`** is never excluded and follows the normal deduplication path.

## Validation

The option must be an array of numbers; non-arrays, non-number entries, and `NaN` throw a `TypeError` at construction. An empty array is valid and means "exclude nothing".

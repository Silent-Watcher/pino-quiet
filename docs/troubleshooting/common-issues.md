# Common issues

## `ERR_PACKAGE_PATH_NOT_EXPORTED` on `import pinoQuiet`

The package's `exports` map is now correct. If you still see this, you are importing from a stale install — `npm install` the fresh package, or rebuild with `npm run build` if working from source.

## `could not be cloned` when passing callbacks

`comparator`, `suffixFormat`, and `onFlush` are functions and cannot survive Pino's worker-thread serialization. Build the transport directly instead:

```ts
const transport = await pinoQuiet({ onFlush: ... });
const logger = pino(transport);
```

See [Pino integration & workers](/guide/pino-integration).

## Records are not collapsing

Check the comparison mode:

- Default mode compares only `msg`. If your records differ in metadata but share `msg`, they collapse — that is expected.
- `strict: true` compares the whole record; two records with different metadata are not duplicates.
- `levelAware: true` prevents records at different levels from collapsing.
- A custom `comparator` overrides everything; `levelAware` still runs first.

Also check `minRepeatsToAnnotate`: below the threshold the batch is emitted without annotation (but still collapsed).

## `repeats` shows 1 for a batch that clearly repeated

`repeats` is the **total occurrences**, including the first. A batch of two identical logs emits `repeats: 2`. A single never-repeated log emits no count field at all.

## The final batch is lost on shutdown

It is not. pino-quiet flushes the pending batch on normal end and on destroy. If you see missing data, the destination was closed before the flush completed — ensure you await the transport's `close` event.

## `flushIntervalMs` auto-flush never fires

`flushIntervalMs: 0` disables the idle timer. Set it to a positive value (default `5000`) to restore auto-flushing.

## Excluded records are still being annotated

`excludeLevels` records bypass deduplication entirely and are never annotated. If you see annotation on them, the level value in the record does not match the configured number — Pino's standard levels are 10/20/30/40/50/60; check the actual `level` field.

## Pipeline mode drops the last batch on error

It does not: the pending record is flushed to the downstream stage if it is still alive, otherwise it is written to `stderr`. If you are not seeing it, the downstream stage was already destroyed.
# Common issues

## `ERR_PACKAGE_PATH_NOT_EXPORTED` on `import pinoQuiet`

Releases up to and including 1.0.1 shipped an `exports` map without an `import` condition, so a direct `import pinoQuiet from 'pino-quiet'` failed. The fix is on `master` and ships with the next release.

Until then, load pino-quiet through Pino's `transport.target` (which is unaffected) or with `require()`. If you are on a release that includes the fix and still see the error, you are importing from a stale install: reinstall, or rebuild with `npm run build` when working from source.

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

## `repeats` looks one higher than the number of extra logs

`repeats` is the **total occurrences**, including the first. A batch of two identical logs emits `repeats: 2`. A single never-repeated log emits no count field at all (inside `onFlush`, `meta.repeats` is `1` for it).

## The final batch is lost on shutdown

It is not. pino-quiet flushes the pending batch on normal end and on destroy. If you see missing data, the destination was closed before the flush completed — ensure you await the transport's `close` event.

## `flushIntervalMs` auto-flush never fires

`flushIntervalMs: 0` disables the idle timer. Set it to a positive value (default `5000`) to restore auto-flushing.

## Excluded records are still being annotated

`excludeLevels` records bypass deduplication entirely and are never annotated. If you see annotation on them, the level value in the record does not match the configured number — Pino's standard levels are 10/20/30/40/50/60; check the actual `level` field.

## Pipeline mode drops the last batch on error

It does not: the pending record is flushed to the downstream stage if it is still alive, otherwise it is written to `stderr`. If you are not seeing it, the downstream stage was already destroyed.

## Different records were merged and some data is missing

You are most likely logging objects without a `msg` in simple mode, where all such records count as duplicates. Use `strict: true` or a `comparator`. See [Limitations](/guide/limitations#no-msg).

## The same message appears several times instead of once

Collapsing is per batch. A message can be written more than once if records are interleaved with others, if `maxRepeats` was reached, or if the idle timer fired (`flushIntervalMs`) between two bursts. See [Batching & flushing](/guide/flushing).

## The collapsed line has no `repeats` field

Check `minRepeatsToAnnotate` (small batches are written without a count), and `msg`: with a non-string `msg` the count field is set but the suffix cannot be added.

## The last log before a crash is missing

A pending batch is flushed on normal exits, `process.exit()`, and uncaught exceptions, but not on `SIGKILL` or an OOM kill. Add the important levels to `excludeLevels` and lower `flushIntervalMs`. See [Shutdown & durability](/guide/shutdown).

## pino-pretty prints `repeats` on its own line

The count is a regular field, so pino-pretty prints it below the message. The suffix already shows the count, so you can hide the field:

```ts
{ target: 'pino-pretty', options: { ignore: 'pid,hostname,repeats' } }
```

## An invalid option does nothing visible

Invalid options throw when the transport is created. Through Pino's worker the error arrives as an `error` event on the transport, so attach a listener. A direct `await pinoQuiet(...)` rejects. See [`pinoQuiet()`](/api/factory).

# Options

All options are optional. Every default is verified against the implementation; when an option is omitted, behavior is identical to the previous release.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `destination` | `string \| number` | `1` (stdout) | Destination file path or fd. Passed to SonicBoom. Ignored when `pipeline: true`. |
| `strict` | `boolean` | `false` | Compare the whole record (minus `ignoreKeys`) instead of only `msg`. |
| `countField` | `string` | `'repeats'` | Field receiving the total occurrence count. |
| `ignoreKeys` | `string[]` | built-ins merged | Extra fields excluded from strict comparison. Merged with `time`, `pid`, `hostname`. |
| `comparator` | `(prev, curr) => boolean` | — | Custom equality; overrides strict/simple. `levelAware` still runs first. Direct invocation only. |
| `excludeLevels` | `number[]` | — | Numeric levels that bypass deduplication entirely. |
| `levelAware` | `boolean` | `false` | Different `level` values are never duplicates. |
| `caseInsensitive` | `boolean` | `false` | Case-insensitive `msg` comparison (simple mode only). |
| `maxRepeats` | `number` | `Infinity` | Force-flush when a batch reaches this many total occurrences. `Infinity` disables. |
| `flushIntervalMs` | `number` | `5000` | Auto-flush a buffered batch after this many ms of silence. `0` disables. |
| `minRepeatsToAnnotate` | `number` | `1` | Only annotate (`countField` / msg suffix) when the total count reaches this. |
| `annotateMessage` | `boolean` | `true` | If `false`, only `countField` is set; `msg` is untouched. |
| `suffixFormat` | `(count) => string` | `` (c) => ` (x${c})` `` | Custom msg suffix. Direct invocation only. |
| `includeTimestamps` | `boolean` | `false` | Add first/last-seen epoch-ms timestamps to every flushed record. |
| `firstSeenField` | `string` | `'firstSeen'` | Field name for the first-seen timestamp. |
| `lastSeenField` | `string` | `'lastSeen'` | Field name for the last-seen timestamp. |
| `onFlush` | `(log, meta) => void` | — | Hook called before every flush. Never throws. Direct invocation only. |
| `pipeline` | `boolean` | `false` | Pass-through Transform mode for pipeline composition. |
| `mkdir` | `boolean` | `false` | → SonicBoom (destination mode only). |
| `append` | `boolean` | `true` | → SonicBoom (destination mode only). |
| `sync` | `boolean` | `false` | → SonicBoom (destination mode only). |

## Repeat-count semantics

- `countField` and `meta.repeats` hold the **total occurrences** of the batch, including the first record. A batch of three identical logs emits `repeats: 3`.
- `maxRepeats: N` flushes when total occurrences reach `N`.
- `minRepeatsToAnnotate: N` suppresses annotation when the total is below `N`; timestamps (if enabled) are still added.
- A single, never-repeated record is emitted untouched (no count field, no suffix).

## Flush triggers

A buffered batch is flushed when: a different record arrives, `maxRepeats` is reached, `flushIntervalMs` of silence elapses, the stream ends, or the transport is destroyed/errored (the pending record goes to the destination, or to `stderr` when downstream is gone).

## Validation

Invalid configurations throw at construction, before any log is processed:

| Input | Error |
| --- | --- |
| `maxRepeats` / `flushIntervalMs` / `minRepeatsToAnnotate` not a number or `NaN` | `RangeError` |
| `maxRepeats < 1` (other than `Infinity`) | `RangeError` |
| `flushIntervalMs < 0` | `RangeError` |
| `minRepeatsToAnnotate < 1` | `RangeError` |
| `comparator` / `suffixFormat` / `onFlush` not a function | `TypeError` |
| `ignoreKeys` not an array of strings | `TypeError` |
| `excludeLevels` not an array of numbers (or contains `NaN`) | `TypeError` |
| `countField` / `firstSeenField` / `lastSeenField` empty, non-string, or `__proto__` | `TypeError` |

`Infinity` for `maxRepeats` and `0` for `flushIntervalMs` are valid documented values.

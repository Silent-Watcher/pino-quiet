# Configuration defaults

Defaults live in `src/constants.ts` (plus `resolveOptions` in `src/utils.ts` for `suffixFormat`) and are pinned by tests. When an option is omitted, behavior matches this table exactly.

| Option | Default | Notes |
| --- | --- | --- |
| `destination` | `1` | stdout |
| `strict` | `false` | simple `msg` comparison |
| `countField` | `'repeats'` | total occurrences |
| `ignoreKeys` | `['time', 'pid', 'hostname']` | user keys are merged, never replace |
| `levelAware` | `false` | |
| `caseInsensitive` | `false` | |
| `maxRepeats` | `Infinity` | disabled |
| `flushIntervalMs` | `5000` | idle batches flush after 5s; `0` disables |
| `minRepeatsToAnnotate` | `1` | every repeated batch is annotated |
| `annotateMessage` | `true` | `msg` gets the `" (xN)"` suffix |
| `suffixFormat` | `` (count) => ` (x${count})` `` | |
| `includeTimestamps` | `false` | |
| `firstSeenField` | `'firstSeen'` | |
| `lastSeenField` | `'lastSeen'` | |
| `excludeLevels` | — (undefined) | no exclusions |
| `pipeline` | `false` | terminal destination mode |
| `mkdir` | `false` | |
| `append` | `true` | |
| `sync` | `false` | asynchronous SonicBoom writes |

## Historical note

`flushIntervalMs` defaulted to disabled (behaving like `0`) before 1.0.0. Since 1.0.0 it defaults to `5000`; set `flushIntervalMs: 0` to restore the old timing. See [Migrating from 0.9.x](/migration/from-0.x).

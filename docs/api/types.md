# Types

All types are exported from the package root and ship in `dist/index.d.ts`.

```ts
import type { FlushMeta, LogRecord, PinoQuietOptions, ResolvedOptions } from 'pino-quiet';
```

## `PinoQuietOptions`

The user-facing option object. Every field is optional. See [Options](/api/options) for the full reference; the interface in the source carries the authoritative per-option documentation.

## `LogRecord`

```ts
type LogRecord = Record<string, any>;
```

A parsed Pino log line. Loosely typed because Pino allows arbitrary user fields.

## `FlushMeta`

Metadata passed to `onFlush` describing the batch that was just emitted:

| Field | Type | Meaning |
| --- | --- | --- |
| `repeats` | `number` | Total occurrences in the batch (1 = never duplicated) |
| `firstSeen` | `number` | Epoch ms when the first occurrence was buffered |
| `lastSeen` | `number` | Epoch ms when the most recent occurrence was buffered |

## `ResolvedOptions`

The merged, validated options object produced by `resolveOptions()`. All optional fields are filled with their defaults. Exposed for completeness; you normally never touch it.

## `INTERNAL_TRANSFORM` (advanced)

```ts
const INTERNAL_TRANSFORM: unique symbol;
```

A symbol property on pipeline-mode transports holding the internal collapsing Transform (the readable side of the returned Duplex). Intended for tests and introspection; not part of the stable API contract.

<div align="center">
  <img src="assets/pino-quiet.png" alt="pino-quiet" width="935" height="267">

  <h1>pino-quiet</h1>

  <p>
    <a href="#features">Features</a> •
    <a href="#installation">Installation</a> •
    <a href="#quick-start">Quick start</a> •
    <a href="#options">Options</a> •
    <a href="#composing-with-other-transports">pino-pretty &amp; other transports</a> •
    <a href="#migrating-from-09x">Migrating from 0.9.x</a>
  </p>

  <p>
    <a href="https://github.com/Silent-Watcher/pino-quiet/blob/master/LICENSE">
      <img src="https://img.shields.io/github/license/Silent-Watcher/pino-quiet?color=#2fb64e">
    </a>
    <a href="https://www.npmjs.com/package/pino-quiet">
      <img src="https://img.shields.io/npm/v/pino-quiet?color=#2fb64e">
    </a>
    <a href="https://github.com/Silent-Watcher/pino-quiet/actions">
      <img src="https://github.com/Silent-Watcher/pino-quiet/actions/workflows/ci.yaml/badge.svg">
    </a>
  </p>
</div>

> `pino-quiet` is a lightweight [Pino](https://getpino.io) transport that **reduces log noise** by collapsing repeated consecutive log messages into a single entry with a repetition counter.

It improves readability, cuts storage/ingestion costs, and requires zero changes to your existing logging calls.

```
{"level":30,"msg":"Connecting..."}     ┐
{"level":30,"msg":"Connecting..."}     ├──▶  {"level":30,"msg":"Connecting... (x3)","repeats":3}
{"level":30,"msg":"Connecting..."}     ┘
{"level":30,"msg":"Connected!"}        ──▶  {"level":30,"msg":"Connected!"}
```

## Features

- **Zero-config** — works out of the box with sane defaults.
- **Noise reduction** — turns 1,000 `"Connection failed"` logs into one `(x1000)` log.
- **Two comparison modes** — fast message-only matching (`simple`, default), or deep object comparison (`strict`).
- **Composable** — can sit *before* `pino-pretty` (or any transport) in a pipeline, or run standalone as a terminal transport.
- **Self-healing buffers** — an idle repeated log auto-flushes after `flushIntervalMs` instead of hiding a stale count forever.
- **Hot-loop safe** — `maxRepeats` caps how long a single batch can grow before force-flushing.
- **Level-aware matching** — optionally never collapse an `info` and an `error` that happen to share text.
- **Pluggable equality** — bring your own `comparator` for full control over what counts as "the same log".
- **Observability hook** — `onFlush` lets you feed collapse events into your own metrics.
- **Fully typed** — first-class TypeScript definitions ship with the package.

## Installation

```sh
npm i pino-quiet
```

```sh
pnpm add pino-quiet
```

```sh
yarn add pino-quiet
```

Requires Node.js `>= 18` and `pino ^10`.

## Quick start

### Standalone (writes to stdout / a file — classic mode)

```ts
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-quiet',
    // options are entirely optional — sensible defaults are used otherwise
  },
});

logger.info('Connecting...');
logger.info('Connecting...');
logger.info('Connecting...');
logger.info('Connected!');

// Output:
// {"level":30,"time":...,"msg":"Connecting... (x3)","repeats":3}
// {"level":30,"time":...,"msg":"Connected!"}
```

### Strict mode (deep object comparison)

If you log metadata objects, you might want to deduplicate based on the entire object content (ignoring `time`, `pid`, and `hostname`).

```ts
const logger = pino({
  transport: {
    target: 'pino-quiet',
    options: {
      strict: true, // Enable deep comparison
    },
  },
});

// These collapse: the { id: 1 } payload matches even though timestamps differ.
logger.error({ id: 1 }, 'Transaction failed');
logger.error({ id: 1 }, 'Transaction failed');
```

## Options

| Option                 | Type                                          | Default                | Description                                                                                       |
| ----------------------- | --------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| `destination`           | `string \| number`                            | `1` (stdout)            | Destination fd or file path. Ignored when `pipeline: true`.                                        |
| `strict`                | `boolean`                                     | `false`                 | Compare the whole log object (minus `ignoreKeys`) instead of just `msg`.                            |
| `countField`            | `string`                                      | `'repeats'`             | Field name used to store the total occurrence count.                                                |
| `ignoreKeys`            | `string[]`                                    | `[]` (merged with built-ins) | Extra fields excluded from `strict` comparisons. Merged with `time`/`pid`/`hostname`, never replaces them. |
| `comparator`            | `(prev, curr) => boolean`                     | —                       | Custom equality function; overrides `strict`/simple logic entirely when provided.                   |
| `levelAware`            | `boolean`                                     | `false`                 | If `true`, logs at different `level`s are never treated as duplicates.                              |
| `caseInsensitive`       | `boolean`                                     | `false`                 | Case-insensitive `msg` comparison (simple mode only).                                                |
| `maxRepeats`            | `number`                                      | `Infinity`              | Force-flush after this many repeats, even without a new/different log arriving.                     |
| `flushIntervalMs`       | `number`                                      | `5000`                  | Auto-flush a buffered log after this many ms of silence. `0` disables this (matches pre-1.0 behavior). |
| `minRepeatsToAnnotate`  | `number`                                      | `1`                     | Only annotate `msg`/`countField` once the repeat count reaches this value.                          |
| `annotateMessage`       | `boolean`                                     | `true`                  | If `false`, only `countField` is set; `msg` is left untouched.                                       |
| `suffixFormat`          | `(count: number) => string`                   | `` (count) => ` (x${count})` `` | Customize the suffix appended to `msg`.                                                              |
| `includeTimestamps`     | `boolean`                                     | `false`                 | Add first/last-seen epoch-ms timestamps to every flushed log.                                       |
| `firstSeenField`        | `string`                                      | `'firstSeen'`           | Field name for the first-seen timestamp (requires `includeTimestamps`).                              |
| `lastSeenField`         | `string`                                      | `'lastSeen'`            | Field name for the last-seen timestamp (requires `includeTimestamps`).                                |
| `onFlush`               | `(log, meta) => void`                         | —                       | Called on every flush with the emitted log and `{ repeats, firstSeen, lastSeen }`. Never throws.    |
| `pipeline`              | `boolean`                                     | `false`                 | Pass-through Transform mode for composing with other transports (see below).                        |
| `mkdir`                 | `boolean`                                     | `false`                 | Passed through to `SonicBoom` (destination mode only).                                              |
| `append`                | `boolean`                                     | `true`                  | Passed through to `SonicBoom` (destination mode only).                                              |
| `sync`                  | `boolean`                                     | `false`                 | Passed through to `SonicBoom` (destination mode only).                                              |

## How it works

- `pino-quiet` buffers the most recently seen log.
- When a new log arrives, it's compared against the buffered one using `comparator` (if given), otherwise `strict`/simple matching.
- **Match:** the counter increments; nothing is written yet.
- **No match** (or the buffered log has sat idle past `flushIntervalMs`, or hit `maxRepeats`): the buffered log is flushed (annotated with its final count) and the new log takes its place.
- On stream shutdown, whatever is still buffered is flushed so no log is ever lost.

## Composing with other transports

By default (`pipeline` not set), pino-quiet is a **terminal** transport: it owns its destination and writes directly to it, exactly like in the Quick start examples above. That's the simplest setup and is unchanged from 0.9.x.

To place pino-quiet *before* another transport — most commonly `pino-pretty` — set `pipeline: true`. This turns it into a plain pass-through stream that emits deduplicated NDJSON for the next stage to consume, instead of writing anywhere itself:

```ts
import pino from 'pino';

const logger = pino({
  transport: {
    pipeline: [
      {
        target: 'pino-quiet',
        options: { pipeline: true, flushIntervalMs: 2000 },
      },
      {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    ],
  },
});

logger.info('Database connection failed');
logger.info('Database connection failed');
logger.info('Database connection failed');
logger.error('Giving up on database. Exiting.');
```

```
[12:00:01] INFO: Database connection failed (x3)
    repeats: 3
[12:00:01] ERROR: Giving up on database. Exiting.
```

This works with any transport that can be a pipeline stage, not just `pino-pretty` — for example shipping the collapsed stream on to a log-forwarding transport. See `example/pipeline-with-pino-pretty.ts` for a runnable copy of this example.

> **Note:** `destination`, `mkdir`, `append`, and `sync` are ignored in pipeline mode — the *last* stage in the pipeline is responsible for the actual destination.

## Migrating from 0.9.x

1. **The stray `]` bug is fixed.** If you had a workaround stripping a trailing `]` from pino-quiet's output, remove it.
2. **`flushIntervalMs` now defaults to `5000`**, not disabled. If your tests or tooling depend on the exact pre-1.0 timing (never auto-flush), set `flushIntervalMs: 0`.
3. Everything else is additive — no other option names or defaults changed.

## Recipes

<details>
<summary>Never collapse errors with info logs that share text</summary>

```ts
options: { levelAware: true }
```
</details>

<details>
<summary>Deduplicate ignoring a request-scoped field</summary>

```ts
options: { strict: true, ignoreKeys: ['requestId', 'traceId'] }
```
</details>

<details>
<summary>Track collapse events in your own metrics</summary>

```ts
options: {
  onFlush: (log, meta) => {
    metrics.histogram('log.repeats', meta.repeats);
  },
}
```
</details>

<details>
<summary>Cap runaway hot loops</summary>

```ts
options: { maxRepeats: 500, flushIntervalMs: 1000 }
```
</details>

## Contributing

Contributions welcome! Please open an issue for feature requests or bugs before submitting a PR.

```sh
git clone https://github.com/Silent-Watcher/pino-quiet.git
cd pino-quiet
npm install
npm test
```

See [CHANGELOG.md](./CHANGELOG.md) for release history.

---

## License

MIT — see [`LICENSE`](./LICENSE) for details.

---

<div align="center">
  <p>
    <sub>Built with ❤️ by <a href="https://github.com/Silent-Watcher" target="_blank">Ali Nazari</a>, for developers.</sub>
  </p>
  <p>
    <a href="https://github.com/Silent-Watcher/pino-quiet">⭐ Star us on GitHub</a> •
    <a href="https://www.linkedin.com/in/alitte/">🐦 Follow on Linkedin</a>
  </p>
</div>

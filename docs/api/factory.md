# `pinoQuiet()`

The package's default export builds the transport.

```ts
import pinoQuiet from 'pino-quiet';
import type { PinoQuietOptions } from 'pino-quiet';

function pinoQuiet(options?: PinoQuietOptions): Promise<Transform>;
```

You rarely call it yourself: Pino calls it for you when you set `transport.target: 'pino-quiet'`. Call it directly when you need the [callback options](/guide/pino-integration#callbacks), or when you bundle your application.

## Direct usage

```ts
import pino from 'pino';
import pinoQuiet from 'pino-quiet';

const transport = await pinoQuiet({
  destination: './app.log',
  comparator: (previous, current) => previous.code === current.code,
  onFlush: (log, meta) => {
    metrics.histogram('log.repeats', meta.repeats);
  },
});

const logger = pino(transport);
```

The function is `async`, so:

- it returns a **promise**; `await` it;
- invalid options **reject** the promise (they are not thrown synchronously) with a `RangeError` or `TypeError`, see [Validation](/api/options#validation);
- when Pino loads the target in a worker and an option is invalid, the error is emitted as an `error` event on the transport. Attach a listener, otherwise the event is unhandled.

## Modes

| `pipeline` | What it returns | Where records go |
| --- | --- | --- |
| `false` (default) | A terminal transport | Its own `destination` (stdout, file path, or fd) |
| `true` | A pass-through stage | The next stage of `pino.transport({ pipeline })` |

See [Pipeline mode](/guide/pipeline). `pipeline: true` is meant for use inside a Pino pipeline, not for direct use.

## Closing

Call `end()` on the transport and wait for `close`. The pending batch is written during close. See [Shutdown & durability](/guide/shutdown).

## Exports

| Export | Kind | Notes |
| --- | --- | --- |
| `default` | function | The factory above |
| `PinoQuietOptions` | type | See [Options](/api/options) |
| `FlushMeta` | type | Second argument of `onFlush` |
| `LogRecord` | type | A parsed Pino line |
| `ResolvedOptions` | type | Options after defaults are applied |
| `INTERNAL_TRANSFORM` | symbol | Introspection and tests only, not a stable API |

Only the package root is exported. See [Types](/api/types).

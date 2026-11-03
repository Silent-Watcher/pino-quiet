# Pino integration & workers

## Standard worker transport

The canonical usage runs pino-quiet inside Pino's worker thread:

```ts
pino({ transport: { target: 'pino-quiet', options: {} } })
```

This is fully supported and integration-tested (destination mode, pipeline mode, graceful shutdown, output format).

## Option serialization

Pino serializes transport options with the **Structured Clone** algorithm before passing them to the worker thread. Functions cannot be cloned. This splits the option surface into two groups:

### Work everywhere (serializable)

`destination`, `strict`, `countField`, `ignoreKeys`, `levelAware`, `caseInsensitive`, `maxRepeats`, `flushIntervalMs`, `minRepeatsToAnnotate`, `annotateMessage`, `includeTimestamps`, `firstSeenField`, `lastSeenField`, `excludeLevels`, `pipeline`, `mkdir`, `append`, `sync`

### Callback options — direct factory invocation only

`comparator`, `suffixFormat`, `onFlush` are functions. Passing them through `pino({ transport: { target: 'pino-quiet', options: { ... } } })` fails with:

```
DOMException: () => ... could not be cloned.
```

This happens inside Pino before pino-quiet runs; the package cannot improve the error message. To use callbacks, build the transport yourself and hand it to Pino:

```ts
import pino from 'pino';
import pinoQuiet from 'pino-quiet';

const transport = await pinoQuiet({
  destination: './app.log',
  onFlush: (log, meta) => {
    metrics.histogram('log.repeats', meta.repeats);
  },
});

const logger = pino(transport);
```

This works because the factory runs in *your* process — no serialization boundary is crossed. It also works with bundler-based setups and when loading the transport from a local module.

## Callback error policies

| Callback | Failure behavior |
| --- | --- |
| `comparator` throws | Error reported to `stderr`; record treated as *not* a duplicate (pending batch flushed); logging continues |
| `suffixFormat` throws | Error reported to `stderr`; log emitted without the suffix; `countField` still set |
| `onFlush` throws | Error reported to `stderr`; log emitted unchanged |

None of these can crash the logging pipeline or lose a buffered log.

## Pino version compatibility

| Pino | Status |
| --- | --- |
| ^10 | Supported and integration-tested |
| ^9 | Supported and integration-tested (CI job) |

The declared peer dependency range is `pino: ^9.0.0 || ^10.0.0`.

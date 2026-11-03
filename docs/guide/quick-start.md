# Quick start

## Standalone (destination mode)

The default mode: pino-quiet is the whole transport and writes collapsed NDJSON to stdout or a file.

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

## Writing to a file

```ts
const logger = pino({
  transport: {
    target: 'pino-quiet',
    options: { destination: './app.log' },
  },
});
```

`destination` accepts a file path or a file descriptor number. `mkdir`, `append`, and `sync` are passed through to the underlying [SonicBoom](https://github.com/mcollina/sonic-boom) destination.

## Before pino-pretty (pipeline mode)

```ts
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
[12:00:01] INFO: Database connection failed (x2)
    repeats: 2
[12:00:01] ERROR: Giving up on database. Exiting.
```

See [Pipeline mode](/guide/pipeline) for details.

## Never collapse errors

```ts
options: { excludeLevels: [50] } // 50 is the standard Pino error level
```

See [Excluded levels](/guide/excluded-levels).

# Shutdown & durability

pino-quiet keeps **at most one batch** in memory. That batch is the only thing at risk when the process stops.

## What happens on exit

| Scenario | Pending batch |
| --- | --- |
| Process ends normally | Flushed |
| `process.exit()` | Flushed |
| `SIGTERM` handled by your code, then exit | Flushed |
| Uncaught exception | Flushed |
| `SIGKILL`, OOM kill, power loss | **Lost** (nothing can run) |

These scenarios were checked with a real Pino worker transport on Node 22 and Pino 10. The graceful-shutdown path is also covered by the integration tests.

## Protecting the last log

The last record before a hard kill is often the most important one (an error), and it may still be waiting in the buffer. In an experiment where the process received `SIGKILL` 400 ms after logging a warning twice and an error:

- default options: the repeated warning was written, the final **error was lost**;
- with `excludeLevels: [50, 60]`: both were written.

Excluded records are written immediately instead of being buffered. Two options make the exposure smaller:

```ts
options: {
  excludeLevels: [50, 60], // error and fatal never wait in the buffer
  flushIntervalMs: 1000,   // an idle batch waits at most 1 s
}
```

Writes to the destination are asynchronous unless `sync: true`, so even an excluded record can be lost if the process is killed in the same instant. Use `sync: true` if that matters more than throughput.

## Flushing explicitly (scripts and tests)

```ts
import { once } from 'node:events';
import pino from 'pino';

const transport = pino.transport({
  target: 'pino-quiet',
  options: { destination: './app.log' },
});
const logger = pino(transport);

logger.info('done');
logger.info('done');

logger.flush();
transport.end();
await once(transport, 'close');
```

Wait for `close` before reading the file or exiting; the final batch is written during close.

## Pipeline mode

On a normal end the pending record is passed to the next stage. If the pipeline is destroyed or errors first, the record is written to `stderr` instead of being dropped. See [Pipeline mode](/guide/pipeline).

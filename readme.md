<div align="center">
  <img src="assets/pino-quiet.png" alt="pino-quiet" width="935" height="267">

  <h1>pino-quiet</h1>

  <p>
	<a href="#features">features</a> •
	<a href="#Installation">Installation</a> •
	<a href="#Usage">Usage</a>
  </p>


  <p>
    <a href="https://github.com/Silent-Watcher/pino-quiet/blob/master/LICENSE">
      <img src="https://img.shields.io/github/license/Silent-Watcher/pino-quiet?color=#2fb64e">
    </a>
  </p>

</div>

> pino-quiet is a lightweight  transport that **reduces log noise** by collapsing repeated consecutive log messages into a single entry with a repetition counter.

It improves readability, cuts storage costs, and requires zero changes to your existing logging calls.

## Features

- Zero-Config: Works out of the box with standard defaults.

- Noise Reduction: Turns 1,000 "Connection Failed" logs into 1 log with (x1000).

- High Performance: Runs in a worker thread via pino-abstract-transport to keep your main loop free.

- Flexible: Supports "Simple" mode (message only) or "Strict" mode (deep object comparison).

## Installation

```sh
npm i pino-quiet
```

## Usage

### Basic Usage (msg comparison)

By default, `pino-quiet` only checks if the log `msg` string is identical. This is the fastest method.

```ts
const logger = pino({
  transport: {
    target: 'pino-quiet',
    options: {
      // By default, writes to stdout (fd 1)
    }
  }
});

logger.info('Connecting...');
logger.info('Connecting...');
logger.info('Connecting...');
logger.info('Connected!');

// Output:
// {"level":30,"time":...,"msg":"Connecting... (x3)","repeats":3}
// {"level":30,"time":...,"msg":"Connected!"}
```

### Strict Usage (Deep comparison)

If you log metadata objects, you might want to deduplicate based on the entire object content (ignoring `time`, `pid`, and `hostname`).

```ts
const logger = pino({
  transport: {
    target: 'pino-quiet',
    options: {
      strict: true // Enable deep comparison
    }
  }
});

// These will be collapsed because the data { id: 1 } matches,
// even though the timestamps differ.
logger.error({ id: 1 }, 'Transaction failed');
logger.error({ id: 1 }, 'Transaction failed');
```

## How it works

- `pino-quiet` buffers the most recent log message.

- When a new log arrives, it compares it to the buffered log.

- If Match: It increments a counter and does not write to output.

- If Different: It flushes the buffered log (with the updated count) and buffers the new one.


## Contributing

Contributions welcome! Please open issues for feature requests or bugs.

---

## License

MIT — see `LICENSE` for details.

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


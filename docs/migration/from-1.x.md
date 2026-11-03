# Upgrading from 1.0.x

The changes below are on `master` and listed under *Unreleased* in the [changelog](https://github.com/Silent-Watcher/pino-quiet/blob/master/CHANGELOG.md). They ship with the next release. Nothing here changes defaults or the output shape.

## What you get

- **`import pinoQuiet from 'pino-quiet'` works.** 1.0.x failed with `ERR_PACKAGE_PATH_NOT_EXPORTED`. If you worked around it (for example with `createRequire`), you can remove the workaround.
- **[`excludeLevels`](/guide/excluded-levels)**: a new opt-in option.
- **Safer failures.** A throwing `comparator` or `suffixFormat` no longer crashes the pipeline; the error goes to `stderr`. A pipeline that is torn down with a pending log writes that log to `stderr` instead of dropping it.
- **Own `__proto__` keys** in strict-mode records are compared correctly.
- **Wider requirements**: Node.js `>= 20` (was `>= 22.18`) and `pino ^9 || ^10` (was `^10.1`).

## What to check

Invalid options now throw when the transport is created. Configurations that were already broken are rejected with a clear message:

- `NaN` or non-number `maxRepeats`, `flushIntervalMs`, `minRepeatsToAnnotate`;
- non-function `comparator`, `suffixFormat`, `onFlush`;
- `ignoreKeys` that is not an array of strings;
- `countField`, `firstSeenField`, `lastSeenField` that are empty, not strings, or `__proto__`.

Valid configurations, including `maxRepeats: Infinity` and `flushIntervalMs: 0`, are unchanged. See [Validation](/api/options#validation).

## Checklist

- [ ] Upgrade to the release that contains these changes
- [ ] Remove any `import` workaround
- [ ] Make sure no option is `NaN`, `undefined` by mistake, or the wrong type

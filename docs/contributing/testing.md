# Testing

## Running the suite

```sh
npm test          # vitest run --coverage
npm run tsc      # type-check
npm run build    # production build
npm run test:pack # pack smoke test
```

## What is covered

- **Unit tests** (`tests/utils.test.ts`, `tests/deduper.test.ts`, `tests/reliability.test.ts`): option resolution, comparison safety (including `__proto__`), callback error policies, validation, timer behavior.
- **Transport tests** (`tests/transport.destination.test.ts`, `tests/transport.pipeline.test.ts`, `tests/pipeline.destroy.test.ts`): destination mode, pipeline mode, lifecycle, error paths, teardown buffer safety.
- **Real Pino integration** (`tests/pino.integration.test.ts`): worker transport destination mode, pipeline with `pino/file` and `pino-pretty`, worker serialization matrix, direct factory callback invocation.
- **Feature tests** (`tests/exclude-levels.test.ts`): the `excludeLevels` option in unit, destination, pipeline, and worker modes.

## Test policy

- Never delete a failing test to make the suite green.
- Never weaken assertions without an approved justification.
- Never skip a failing test.
- Never use a mock to bypass an integration behavior that should be tested for real.
- Never report success based only on unit tests when an actual Pino integration is required.

## Adding a test

1. Reproduce the bug or behavior with a failing test.
2. Implement the minimal fix.
3. Verify the new test passes.
4. Run the full suite: `npm test`.
5. Run `npm run tsc`, `npm run build`, and `npm run check`.

## Baseline

The existing test suite is the immovable baseline. Every change must keep all previously passing tests green.
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { afterEach, describe, expect, it } from 'vitest';
import pinoQuiet from '../src/index';

let tmpFile: string;

function tempPath() {
	tmpFile = path.join(
		os.tmpdir(),
		`pino-quiet-int-${Date.now()}-${Math.random()}.log`,
	);
	return tmpFile;
}

function readLines(file: string): Record<string, unknown>[] {
	return fs
		.readFileSync(file, 'utf8')
		.trim()
		.split('\n')
		.filter(Boolean)
		.map((l) => JSON.parse(l));
}

afterEach(() => {
	if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
});

/**
 * Standard Pino Worker Transport usage: `pino({ transport: { target } })`.
 * The transport runs in a worker thread and writes to `destination`.
 */
function runWorkerTarget(options: Record<string, unknown>) {
	const dest = tempPath();
	const transport = pino.transport({
		target: 'pino-quiet',
		options: { ...options, destination: dest },
	});
	const logger = pino(transport);
	return {
		dest,
		logger,
		transport,
		done: async () => {
			logger.flush();
			transport.end();
			await once(transport, 'close');
		},
	};
}

describe('real Pino worker transport (destination mode)', () => {
	it('collapses consecutive duplicates end-to-end through a worker thread', async () => {
		const dest = tempPath();
		const transport = pino.transport({
			target: 'pino-quiet',
			options: { destination: dest, flushIntervalMs: 0 },
		});
		const logger = pino(transport);
		await once(transport, 'ready');
		logger.info('Connecting...');
		logger.info('Connecting...');
		logger.info('Connecting...');
		logger.error('Connected!');
		logger.flush();
		transport.end();
		await once(transport, 'close');

		const rows = readLines(dest);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			msg: 'Connecting... (x3)',
			repeats: 3,
		});
		expect(rows[1]).toMatchObject({ msg: 'Connected!' });
	}, 20000);

	it('flushes a trailing repeated log on graceful shutdown (default flushIntervalMs)', async () => {
		const dest = tempPath();
		const transport = pino.transport({
			target: 'pino-quiet',
			options: { destination: dest },
		});
		const logger = pino(transport);
		await once(transport, 'ready');
		logger.info('bye');
		logger.info('bye');
		logger.flush();
		transport.end();
		await once(transport, 'close');

		const rows = readLines(dest);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ msg: 'bye (x2)', repeats: 2 });
	}, 20000);

	it('supports strict comparison through serialized worker options', async () => {
		const dest = tempPath();
		const transport = pino.transport({
			target: 'pino-quiet',
			options: { destination: dest, strict: true, flushIntervalMs: 0 },
		});
		const logger = pino(transport);
		await once(transport, 'ready');
		logger.info({ id: 1 }, 'req');
		logger.info({ id: 1 }, 'req');
		logger.info({ id: 2 }, 'req');
		logger.flush();
		transport.end();
		await once(transport, 'close');

		const rows = readLines(dest);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({ id: 1, repeats: 2 });
		expect(rows[1]).toMatchObject({ id: 2 });
	}, 20000);

	it('supports ignoreKeys and includeTimestamps through serialized worker options', async () => {
		const dest = tempPath();
		const transport = pino.transport({
			target: 'pino-quiet',
			options: {
				destination: dest,
				strict: true,
				ignoreKeys: ['time', 'pid', 'hostname', 'requestId'],
				includeTimestamps: true,
				firstSeenField: 'seenFrom',
				lastSeenField: 'seenTo',
				flushIntervalMs: 0,
			},
		});
		const logger = pino(transport);
		await once(transport, 'ready');
		logger.info({ requestId: 1 }, 'x');
		logger.info({ requestId: 2 }, 'x');
		logger.flush();
		transport.end();
		await once(transport, 'close');

		const rows = readLines(dest);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ msg: 'x (x2)', repeats: 2 });
		expect(typeof rows[0]?.seenFrom).toBe('number');
		expect(typeof rows[0]?.seenTo).toBe('number');
	}, 20000);
});

describe('real Pino pipeline transports', () => {
	it('works as the first stage before pino/file (valid NDJSON, no duplicates)', async () => {
		const dest = tempPath();
		const transport = pino.transport({
			pipeline: [
				{
					target: 'pino-quiet',
					options: { pipeline: true, flushIntervalMs: 0 },
				},
				{ target: 'pino/file', options: { destination: dest } },
			],
		});
		const logger = pino(transport);
		await once(transport, 'ready');
		logger.info('dup');
		logger.info('dup');
		logger.info('other');
		logger.flush();
		transport.end();
		await once(transport, 'close');

		const rows = readLines(dest);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({ msg: 'dup (x2)', repeats: 2 });
		expect(rows[1]).toMatchObject({ msg: 'other' });
	}, 20000);

	it('works before pino-pretty writing to a file (collapsed, human-readable output)', async () => {
		const dest = tempPath();
		const transport = pino.transport({
			pipeline: [
				{
					target: 'pino-quiet',
					options: { pipeline: true, flushIntervalMs: 0 },
				},
				{
					target: 'pino-pretty',
					options: { destination: dest, colorize: false },
				},
			],
		});
		const logger = pino(transport);
		await once(transport, 'ready');
		logger.info('Database connection failed');
		logger.info('Database connection failed');
		logger.error('Giving up');
		logger.flush();
		transport.end();
		await once(transport, 'close');

		const content = fs.readFileSync(dest, 'utf8');
		expect(content).toContain('Database connection failed (x2)');
		expect(content).toContain('repeats: 2');
		expect(content).toContain('Giving up');
	}, 20000);
});

describe('worker-thread serialization compatibility', () => {
	it('rejects function options through standard worker transport options (Structured Clone)', async () => {
		// All three callback options must fail the same way: Pino serializes
		// transport options before handing them to the worker thread.
		for (const [option, value] of [
			['comparator', () => false],
			['suffixFormat', (c: number) => ` [${c}]`],
			['onFlush', () => {}],
		] as const) {
			expect(() =>
				pino.transport({
					target: 'pino-quiet',
					options: { [option]: value },
				}),
			).toThrow(/could not be cloned/);
		}
	}, 20000);

	it('accepts every plain-data option through serialized worker options', async () => {
		// One worker run exercising the full serializable option surface;
		// if any option failed to clone, the transport would never start.
		const run = runWorkerTarget({
			strict: true,
			ignoreKeys: ['time', 'pid', 'hostname', 'rid'],
			countField: 'hits',
			levelAware: true,
			caseInsensitive: false,
			maxRepeats: 100,
			minRepeatsToAnnotate: 1,
			annotateMessage: true,
			includeTimestamps: true,
			firstSeenField: 'from',
			lastSeenField: 'to',
			mkdir: false,
			append: true,
			sync: false,
			flushIntervalMs: 0,
		});
		await once(run.transport, 'ready');
		run.logger.info({ rid: 1 }, 'same payload');
		run.logger.info({ rid: 2 }, 'same payload');
		await run.done();

		const rows = readLines(run.dest);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ msg: 'same payload (x2)', hits: 2 });
		expect(typeof rows[0]?.from).toBe('number');
	}, 20000);
});

describe('direct factory invocation (callback options work here)', () => {
	it('supports comparator, suffixFormat and onFlush when the factory is called directly', async () => {
		const dest = tempPath();
		const flushed: number[] = [];
		const transport = await pinoQuiet({
			destination: dest,
			flushIntervalMs: 0,
			comparator: (a, b) => a.key === b.key,
			suffixFormat: (count) => ` [x${count}]`,
			onFlush: (_log, meta) => {
				flushed.push(meta.repeats);
			},
		});

		const write = (obj: Record<string, unknown>) =>
			transport.write(`${JSON.stringify(obj)}\n`);
		write({ key: 1, msg: 'a' });
		write({ key: 1, msg: 'a' });
		transport.end();
		await once(transport, 'close');

		const rows = readLines(dest);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ msg: 'a [x2]', repeats: 2 });
		expect(flushed).toEqual([2]);
	});
});

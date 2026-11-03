import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { afterEach, describe, expect, it } from 'vitest';
import { Deduper } from '../src/deduper';
import pinoQuiet from '../src/index';
import { resolveOptions } from '../src/utils';

function emitted(lines: string[]) {
	return lines.map((l) => JSON.parse(l));
}

let tmpFile: string;

function tempPath() {
	tmpFile = path.join(
		os.tmpdir(),
		`pino-quiet-excl-${Date.now()}-${Math.random()}.log`,
	);
	return tmpFile;
}

afterEach(() => {
	if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
});

function runDeduper(opts: Parameters<typeof resolveOptions>[0]) {
	const lines: string[] = [];
	const d = new Deduper(
		resolveOptions({ flushIntervalMs: 0, ...opts }),
		(l) => lines.push(l),
	);
	return { d, lines };
}

describe('excludeLevels (unit, via Deduper)', () => {
	it('is a no-op when the option is omitted (existing behavior)', () => {
		const { d, lines } = runDeduper({});
		d.ingest({ level: 50, msg: 'err' });
		d.ingest({ level: 50, msg: 'err' });
		d.ingest({ level: 30, msg: 'info' });
		expect(emitted(lines)).toHaveLength(1);
		expect(lines[0]).toContain('"repeats":2');
	});

	it('is a no-op for an empty exclusion array', () => {
		const { d, lines } = runDeduper({ excludeLevels: [] });
		d.ingest({ level: 50, msg: 'err' });
		d.ingest({ level: 50, msg: 'err' });
		expect(emitted(lines)).toHaveLength(0);
	});

	it('emits excluded records immediately, untouched, in order', () => {
		const { d, lines } = runDeduper({ excludeLevels: [50] });
		const err = { level: 50, msg: 'Critical database error' };
		d.ingest(err);
		expect(lines).toHaveLength(1);
		expect(JSON.parse(lines[0] ?? '{}')).toEqual(err);
	});

	it('matches the roadmap scenario: flush buffer before exclusion, new batch after', () => {
		const { d, lines } = runDeduper({ excludeLevels: [50] });
		d.ingest({ level: 30, msg: 'Database connection failed' });
		d.ingest({ level: 30, msg: 'Database connection failed' });
		d.ingest({ level: 50, msg: 'Critical database error' });
		d.ingest({ level: 50, msg: 'Critical database error' });
		d.ingest({ level: 30, msg: 'Database connection failed' });
		d.flush();

		const rows = emitted(lines);
		expect(rows).toHaveLength(4);
		expect(rows[0]).toMatchObject({
			msg: 'Database connection failed (x2)',
			repeats: 2,
		});
		// excluded records pass through verbatim, no annotation, no repeats field
		expect(rows[1]).toEqual({ level: 50, msg: 'Critical database error' });
		expect(rows[2]).toEqual({ level: 50, msg: 'Critical database error' });
		// the trailing info starts a NEW batch (count reset), not x3
		expect(rows[3]).toEqual({
			level: 30,
			msg: 'Database connection failed',
		});
	});

	it('supports multiple excluded levels and custom numeric levels', () => {
		const { d, lines } = runDeduper({ excludeLevels: [35, 50] });
		d.ingest({ level: 35, msg: 'custom' });
		d.ingest({ level: 50, msg: 'error' });
		d.ingest({ level: 60, msg: 'fatal-not-excluded' });
		d.flush();
		const rows = emitted(lines);
		expect(rows).toHaveLength(3);
		expect(rows[2]).toMatchObject({ msg: 'fatal-not-excluded' });
	});

	it('handles consecutive excluded logs', () => {
		const { d, lines } = runDeduper({ excludeLevels: [50] });
		d.ingest({ level: 50, msg: 'e1' });
		d.ingest({ level: 50, msg: 'e2' });
		d.ingest({ level: 50, msg: 'e3' });
		expect(emitted(lines)).toHaveLength(3);
	});

	it('does not mutate excluded records and never annotates them', () => {
		const { d, lines } = runDeduper({
			excludeLevels: [50],
			annotateMessage: true,
			includeTimestamps: true,
		});
		const err = { level: 50, msg: 'a' };
		d.ingest({ level: 30, msg: 'x' });
		d.ingest(err);
		expect(Object.keys(err).sort()).toEqual(['level', 'msg']);
		expect(JSON.parse(lines[1] ?? '{}')).toEqual(err);
	});

	it('does not affect the repeat counter of normal logs', () => {
		const { d, lines } = runDeduper({ excludeLevels: [50] });
		d.ingest({ level: 30, msg: 'a' });
		d.ingest({ level: 30, msg: 'a' });
		d.ingest({ level: 50, msg: 'err' });
		d.ingest({ level: 30, msg: 'a' });
		d.flush();
		const rows = emitted(lines);
		expect(rows[0]).toMatchObject({ repeats: 2 });
		// post-exclusion log is a fresh batch of 1
		expect(rows[2]).toEqual({ level: 30, msg: 'a' });
	});

	it('treats records without a numeric level as never excluded', () => {
		const { d, lines } = runDeduper({ excludeLevels: [50] });
		d.ingest({ msg: 'no level' });
		// string '50' is not === 50: still deduplicated, never excluded
		d.ingest({ level: '50', msg: 'no level' });
		d.flush();
		const rows = emitted(lines);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ msg: 'no level (x2)', repeats: 2 });
	});

	it('coexists with strict mode', () => {
		const { d, lines } = runDeduper({
			excludeLevels: [50],
			strict: true,
		});
		d.ingest({ level: 30, id: 1, msg: 'a' });
		d.ingest({ level: 30, id: 1, msg: 'a' });
		d.ingest({ level: 50, id: 9, msg: 'a' });
		d.ingest({ level: 30, id: 1, msg: 'a' });
		d.flush();
		const rows = emitted(lines);
		expect(rows[0]).toMatchObject({ id: 1, repeats: 2 });
		expect(rows[1]).toEqual({ level: 50, id: 9, msg: 'a' });
		expect(rows[2]).toEqual({ level: 30, id: 1, msg: 'a' });
	});

	it('coexists with levelAware and caseInsensitive', () => {
		const { d, lines } = runDeduper({
			excludeLevels: [50],
			levelAware: true,
			caseInsensitive: true,
		});
		d.ingest({ level: 30, msg: 'Hello' });
		d.ingest({ level: 30, msg: 'HELLO' });
		d.ingest({ level: 50, msg: 'bye' });
		d.ingest({ level: 30, msg: 'hello' });
		d.flush();
		const rows = emitted(lines);
		// levelAware only compares same levels; caseInsensitive makes HELLO match Hello
		expect(rows[0]).toMatchObject({ msg: 'Hello (x2)', repeats: 2 });
		expect(rows[1]).toEqual({ level: 50, msg: 'bye' });
		// excluded record broke the batch; the trailing hello starts fresh
		expect(rows[2]).toEqual({ level: 30, msg: 'hello' });
	});

	it('does not call onFlush for excluded records', () => {
		const flushed: unknown[] = [];
		const lines: string[] = [];
		const d = new Deduper(
			resolveOptions({
				flushIntervalMs: 0,
				excludeLevels: [50],
				onFlush: (log, meta) => flushed.push([log.msg, meta.repeats]),
			}),
			(l) => lines.push(l),
		);
		d.ingest({ level: 30, msg: 'a' });
		d.ingest({ level: 50, msg: 'err' });
		d.flush();
		expect(flushed).toEqual([['a', 1]]);
	});

	it('validates the option shape', () => {
		expect(() =>
			resolveOptions({ excludeLevels: '50' as unknown as number[] }),
		).toThrow(TypeError);
		expect(() =>
			resolveOptions({ excludeLevels: [50, '30' as unknown as number] }),
		).toThrow(TypeError);
		expect(() => resolveOptions({ excludeLevels: [Number.NaN] })).toThrow(
			TypeError,
		);
		expect(() => resolveOptions({ excludeLevels: [50, 30] })).not.toThrow();
	});
});

describe('excludeLevels (integration)', () => {
	it('works in destination mode end-to-end', async () => {
		const dest = tempPath();
		const transport = await pinoQuiet({
			destination: dest,
			excludeLevels: [50],
			flushIntervalMs: 0,
		});
		transport.write(`${JSON.stringify({ level: 30, msg: 'a' })}\n`);
		transport.write(`${JSON.stringify({ level: 30, msg: 'a' })}\n`);
		transport.write(`${JSON.stringify({ level: 50, msg: 'err' })}\n`);
		transport.write(`${JSON.stringify({ level: 30, msg: 'a' })}\n`);
		transport.end();
		await once(transport, 'close');

		const rows = fs
			.readFileSync(dest, 'utf8')
			.trim()
			.split('\n')
			.map((l) => JSON.parse(l));
		expect(rows).toHaveLength(3);
		expect(rows[0]).toMatchObject({ msg: 'a (x2)', repeats: 2 });
		expect(rows[1]).toEqual({ level: 50, msg: 'err' });
		expect(rows[2]).toEqual({ level: 30, msg: 'a' });
	});

	it('works in pipeline mode end-to-end', async () => {
		const transport = await pinoQuiet({
			pipeline: true,
			excludeLevels: [50],
			flushIntervalMs: 0,
		});
		const out: string[] = [];
		transport.on('data', (c: Buffer) => out.push(c.toString()));
		transport.write(`${JSON.stringify({ level: 30, msg: 'a' })}\n`);
		transport.write(`${JSON.stringify({ level: 30, msg: 'a' })}\n`);
		transport.write(`${JSON.stringify({ level: 50, msg: 'err' })}\n`);
		transport.write(`${JSON.stringify({ level: 30, msg: 'a' })}\n`);
		transport.end();
		await once(transport, 'close');

		const rows = out
			.join('')
			.trim()
			.split('\n')
			.map((l) => JSON.parse(l));
		expect(rows).toHaveLength(3);
		expect(rows[0]).toMatchObject({ msg: 'a (x2)', repeats: 2 });
		expect(rows[1]).toEqual({ level: 50, msg: 'err' });
	});

	it('works through a real Pino worker transport with serialized options', async () => {
		const dest = tempPath();
		const transport = pino.transport({
			target: new URL('../dist/index.js', import.meta.url).pathname,
			options: {
				destination: dest,
				excludeLevels: [50],
				flushIntervalMs: 0,
			},
		});
		const logger = pino(transport);
		await once(transport, 'ready');
		logger.info('dup');
		logger.info('dup');
		logger.error('excluded error');
		logger.error('excluded error');
		logger.info('dup');
		logger.flush();
		transport.end();
		await once(transport, 'close');

		const rows = fs
			.readFileSync(dest, 'utf8')
			.trim()
			.split('\n')
			.map((l) => JSON.parse(l));
		expect(rows).toHaveLength(4);
		expect(rows[0]).toMatchObject({ msg: 'dup (x2)', repeats: 2 });
		expect(rows[1]).toMatchObject({ msg: 'excluded error', level: 50 });
		expect(rows[2]).toMatchObject({ msg: 'excluded error', level: 50 });
		expect(rows[3]).toEqual(expect.objectContaining({ msg: 'dup' }));
		expect(rows[3].repeats).toBeUndefined();
	}, 20000);
});

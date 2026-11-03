import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import pinoQuiet from '../src/index';

function line(obj: Record<string, unknown>) {
	return `${JSON.stringify(obj)}\n`;
}

let tmpFile: string;

afterEach(() => {
	if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
	vi.restoreAllMocks();
});

function tempPath() {
	tmpFile = path.join(
		os.tmpdir(),
		`pino-quiet-${Date.now()}-${Math.random()}.log`,
	);
	return tmpFile;
}

describe('destination mode (default, backward compatible)', () => {
	it('collapses repeated logs and writes valid NDJSON (no stray characters)', async () => {
		const dest = tempPath();
		const transport = await pinoQuiet({
			destination: dest,
			flushIntervalMs: 0,
		});

		transport.write(line({ level: 30, time: 1, msg: 'Connecting...' }));
		transport.write(line({ level: 30, time: 2, msg: 'Connecting...' }));
		transport.write(line({ level: 30, time: 3, msg: 'Connecting...' }));
		transport.write(line({ level: 30, time: 4, msg: 'Connected!' }));
		transport.end();
		await once(transport, 'close');

		const content = fs.readFileSync(dest, 'utf8');
		const rows = content
			.trim()
			.split('\n')
			.map((l) => JSON.parse(l));

		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			msg: 'Connecting... (x3)',
			repeats: 3,
		});
		expect(rows[1]).toMatchObject({ msg: 'Connected!' });
		// Regression guard for the pre-1.0 stray "]" bug.
		expect(content).not.toMatch(/\]\s*\n/);
	});

	it('supports strict mode, comparing full objects while ignoring volatile fields', async () => {
		const dest = tempPath();
		const transport = await pinoQuiet({
			destination: dest,
			strict: true,
			flushIntervalMs: 0,
		});

		transport.write(
			line({
				level: 50,
				time: 1,
				pid: 111,
				hostname: 'a',
				id: 7,
				msg: 'Transaction failed',
			}),
		);
		transport.write(
			line({
				level: 50,
				time: 2,
				pid: 112,
				hostname: 'b',
				id: 7,
				msg: 'Transaction failed',
			}),
		);
		transport.write(
			line({
				level: 50,
				time: 3,
				pid: 113,
				hostname: 'c',
				id: 8,
				msg: 'Transaction failed',
			}),
		);
		transport.end();
		await once(transport, 'close');

		const rows = fs
			.readFileSync(dest, 'utf8')
			.trim()
			.split('\n')
			.map((l) => JSON.parse(l));

		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({ id: 7, repeats: 2 });
		expect(rows[1]).toMatchObject({ id: 8 });
	});

	it('flushes a single trailing repeated log on stream end', async () => {
		const dest = tempPath();
		const transport = await pinoQuiet({
			destination: dest,
			flushIntervalMs: 0,
		});

		transport.write(line({ msg: 'only one' }));
		transport.end();
		await once(transport, 'close');

		const rows = fs
			.readFileSync(dest, 'utf8')
			.trim()
			.split('\n')
			.map((l) => JSON.parse(l));
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ msg: 'only one' });
	});

	it('closes cleanly with sync: true (no hang, no data loss)', async () => {
		const dest = tempPath();
		const transport = await pinoQuiet({
			destination: dest,
			sync: true,
			flushIntervalMs: 0,
		});

		transport.write(line({ msg: 'a' }));
		transport.write(line({ msg: 'a' }));
		transport.end();

		const timeout = new Promise((_, rej) =>
			setTimeout(() => rej(new Error('CLOSE TIMEOUT')), 5000),
		);
		await Promise.race([once(transport, 'close'), timeout]);

		const rows = fs
			.readFileSync(dest, 'utf8')
			.trim()
			.split('\n')
			.map((l) => JSON.parse(l));
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ msg: 'a (x2)', repeats: 2 });
	});

	it('regression: destroying mid-stream still flushes the buffered log to the destination', async () => {
		const dest = tempPath();
		const transport = await pinoQuiet({
			destination: dest,
			flushIntervalMs: 0,
		});

		transport.write(line({ msg: 'a' }));
		transport.write(line({ msg: 'a' }));
		// Give the transport's input stream one tick to deliver the lines to
		// the deduper (lines still sitting in the input buffer when destroy
		// hits are dropped upstream, before pino-quiet ever sees them).
		await new Promise((resolve) => setImmediate(resolve));
		transport.destroy();
		await once(transport, 'close');

		const rows = fs
			.readFileSync(dest, 'utf8')
			.trim()
			.split('\n')
			.map((l) => JSON.parse(l));
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ msg: 'a (x2)', repeats: 2 });
	});

	it('reports async destination errors on stderr instead of crashing the process', async () => {
		// A directory path cannot be opened for writing -> EISDIR on the
		// async open, surfaced by SonicBoom's 'error' event.
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pino-quiet-err-'));
		try {
			const stderr: string[] = [];
			const spy = vi.spyOn(process.stderr, 'write').mockImplementation(((
				chunk: unknown,
			) => {
				stderr.push(String(chunk));
				return true;
			}) as typeof process.stderr.write);

			const transport = await pinoQuiet({
				destination: dir,
				flushIntervalMs: 0,
			});
			transport.on('error', () => {});
			transport.write(line({ msg: 'a' }));
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(stderr.join('')).toContain(
				'pino-quiet: destination write error',
			);
			expect(stderr.join('')).toContain('EISDIR');
			spy.mockRestore();
			await transport.end();
		} finally {
			fs.rmdirSync(dir);
		}
	});
});

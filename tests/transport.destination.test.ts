import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import pinoQuiet from '../src/index.ts';

function line(obj: Record<string, unknown>) {
	return `${JSON.stringify(obj)}\n`;
}

let tmpFile: string;

afterEach(() => {
	if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
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
});

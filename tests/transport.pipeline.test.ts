import { once } from 'node:events';
import { describe, expect, it } from 'vitest';
import pinoQuiet from '../src/index.ts';

function line(obj: Record<string, unknown>) {
	return `${JSON.stringify(obj)}\n`;
}

async function collect(transform: NodeJS.ReadWriteStream, writes: string[]) {
	let out = '';
	transform.on('data', (chunk: Buffer) => {
		out += chunk.toString();
	});
	for (const w of writes) transform.write(w);
	transform.end();
	await once(transform, 'close');
	return out
		.trim()
		.split('\n')
		.filter(Boolean)
		.map((l) => JSON.parse(l));
}

describe('pipeline mode (pipeline: true)', () => {
	it('yields deduplicated NDJSON downstream instead of writing to a destination', async () => {
		const transform = await pinoQuiet({
			pipeline: true,
			flushIntervalMs: 0,
		});

		const rows = await collect(transform, [
			line({ level: 30, time: 1, msg: 'Connecting...' }),
			line({ level: 30, time: 2, msg: 'Connecting...' }),
			line({ level: 30, time: 3, msg: 'Connecting...' }),
			line({ level: 30, time: 4, msg: 'Connected!' }),
		]);

		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			msg: 'Connecting... (x3)',
			repeats: 3,
		});
		expect(rows[1]).toMatchObject({ msg: 'Connected!' });
	});

	it('produces output that is valid, parseable NDJSON with no trailing artifacts', async () => {
		const transform = await pinoQuiet({
			pipeline: true,
			flushIntervalMs: 0,
		});
		const rows = await collect(transform, [
			line({ msg: 'a' }),
			line({ msg: 'b' }),
		]);
		expect(rows).toHaveLength(2);
	});

	it('can be piped directly into another Node stream (proves pipe-ability with e.g. pino-pretty)', async () => {
		const transform = await pinoQuiet({
			pipeline: true,
			flushIntervalMs: 0,
		});

		const chunks: Buffer[] = [];
		const { Writable } = await import('node:stream');
		const sink = new Writable({
			write(chunk, _enc, cb) {
				chunks.push(chunk);
				cb();
			},
		});

		transform.pipe(sink);
		transform.write(line({ msg: 'x' }));
		transform.write(line({ msg: 'x' }));
		transform.write(line({ msg: 'y' }));
		transform.end();

		await once(sink, 'finish');

		const rows = Buffer.concat(chunks)
			.toString()
			.trim()
			.split('\n')
			.map((l) => JSON.parse(l));
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({ msg: 'x (x2)', repeats: 2 });
	});
});

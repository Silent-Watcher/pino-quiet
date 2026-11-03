import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

let bundlePath: string;

beforeAll(async () => {
	// Destroying the pipeline transport trips a Node `Duplex.from` teardown
	// quirk that surfaces as an uncaught error inside the test runner, so the
	// scenario runs in a child process against a bundled copy of the source.
	const { build } = await import('tsup');
	const outDir = path.resolve(
		__dirname,
		'../node_modules/.pino-quiet-test-build',
	);
	fs.rmSync(outDir, { recursive: true, force: true });
	await build({
		entry: ['src/index.ts'],
		format: ['esm'],
		outDir: path.relative(process.cwd(), outDir),
		dts: false,
		silent: true,
	});
	bundlePath = path.join(outDir, 'index.js');
});

async function runChild(
	code: string,
): Promise<{ stdout: string; stderr: string }> {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pino-quiet-child-'));
	const entry = path.join(dir, 'child.mjs');
	fs.writeFileSync(entry, code);
	try {
		return await execFileAsync(process.execPath, [entry], {
			cwd: process.cwd(),
			timeout: 15000,
		});
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

describe('pipeline teardown (child process, real runtime semantics)', () => {
	it('regression: destroying with a pending log does not silently discard it', async () => {
		const importUrl = JSON.stringify(bundlePath);
		const { stdout } = await runChild(`
			// Tolerate the ABORT_ERR that Node's Duplex.from teardown synthesizes
			// and forwards to the transport's internal split2 stream (upstream
			// noise, not a pino-quiet defect); it must be the ONLY uncaught error.
			const uncaught = [];
			process.on('uncaughtException', (e) => uncaught.push(e));
			const pinoQuiet = (await import(${importUrl})).default;
			const captured = [];
			const orig = process.stderr.write.bind(process.stderr);
			process.stderr.write = (c) => { captured.push(String(c)); return true; };
			const t = await pinoQuiet({ pipeline: true, flushIntervalMs: 0 });
			t.on('error', () => {});
			t.write(JSON.stringify({ msg: 'pending' }) + '\\n');
			t.destroy();
			await new Promise((r) => setTimeout(r, 200));
			process.stderr.write = orig;
			console.log('RESULT=' + JSON.stringify({ captured: captured.join(''), uncaught: uncaught.map((e) => e.code ?? e.message) }));
		`);
		const result = JSON.parse(stdout.split('RESULT=')[1] ?? '{}');
		expect(result.captured).toContain('"msg":"pending"');
		expect(result.captured).toContain('emitting to stderr');
		for (const code of result.uncaught ?? []) {
			expect(code).toBe('ABORT_ERR');
		}
	});
});

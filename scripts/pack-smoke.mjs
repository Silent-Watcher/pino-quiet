#!/usr/bin/env node
/**
 * Pack smoke test: builds the real npm tarball, installs it into a clean
 * consumer project, and verifies the documented usage paths work from the
 * published artifact — ESM import, `require(esm)` interop, Pino worker
 * transport discovery, destination mode, and pipeline mode.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pino-quiet-pack-'));
const step = (msg) => console.log(`pack-smoke: ${msg}`);

function run(cmd, args, cwd) {
	execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'] });
}

try {
	step('packing tarball');
	const out = execFileSync('npm', ['pack', '--pack-destination', workDir], {
		cwd: repoRoot,
		encoding: 'utf8',
	});
	const tarball = path.join(workDir, out.trim().split('\n').pop());

	const consumer = path.join(workDir, 'consumer');
	fs.mkdirSync(consumer);
	fs.writeFileSync(
		path.join(consumer, 'package.json'),
		JSON.stringify({ name: 'pack-smoke-consumer', type: 'module', private: true }),
	);
	step('installing tarball + pino into a clean consumer project');
	run('npm', ['install', '--no-audit', '--no-fund', 'pino@10', tarball], consumer);

	fs.writeFileSync(
		path.join(consumer, 'esm-import.mjs'),
		`const m = await import('pino-quiet');
		 if (typeof m.default !== 'function') throw new Error('ESM import broken');
		 if (typeof m.INTERNAL_TRANSFORM !== 'symbol') throw new Error('named export broken');
		 console.log('PACK_SMOKE_ESM_IMPORT=ok');`,
	);
	fs.writeFileSync(
		path.join(consumer, 'destination-mode.mjs'),
		`import fs from 'node:fs';
		 import pino from 'pino';
		 const dest = process.argv[2];
		 const t = pino.transport({ target: 'pino-quiet', options: { destination: dest, flushIntervalMs: 0 } });
		 const logger = pino(t);
		 await new Promise((r) => t.on('ready', r));
		 logger.info('dup'); logger.info('dup'); logger.info('other');
		 logger.flush(); t.end();
		 await new Promise((r) => t.on('close', r));
		 const rows = fs.readFileSync(dest, 'utf8').trim().split('\\n');
		 if (rows.length !== 2) throw new Error('destination mode produced ' + rows.length + ' rows');
		 if (!rows[0].includes('dup (x2)') || !rows[0].includes('"repeats":2')) throw new Error('unexpected row: ' + rows[0]);
		 console.log('PACK_SMOKE_DESTINATION=ok');`,
	);
	fs.writeFileSync(
		path.join(consumer, 'pipeline-mode.mjs'),
		`import fs from 'node:fs';
		 import pino from 'pino';
		 const dest = process.argv[2];
		 const t = pino.transport({ pipeline: [
			 { target: 'pino-quiet', options: { pipeline: true, flushIntervalMs: 0 } },
			 { target: 'pino/file', options: { destination: dest } },
		 ]});
		 const logger = pino(t);
		 await new Promise((r) => t.on('ready', r));
		 logger.info('dup'); logger.info('dup'); logger.info('other');
		 logger.flush(); t.end();
		 await new Promise((r) => t.on('close', r));
		 const rows = fs.readFileSync(dest, 'utf8').trim().split('\\n').map((l) => JSON.parse(l));
		 if (rows.length !== 2 || rows[0].msg !== 'dup (x2)' || rows[1].msg !== 'other') {
			 throw new Error('pipeline mode output mismatch: ' + JSON.stringify(rows));
		 }
		 console.log('PACK_SMOKE_PIPELINE=ok');`,
	);
	fs.writeFileSync(
		path.join(consumer, 'require-interop.cjs'),
		`const m = require('pino-quiet');
		 if (typeof m.default !== 'function') throw new Error('require(esm) broken');
		 console.log('PACK_SMOKE_REQUIRE=ok');`,
	);

	for (const script of [
		'esm-import.mjs',
		'destination-mode.mjs',
		'pipeline-mode.mjs',
		'require-interop.cjs',
	]) {
		step(`running ${script}`);
		const stdout = execFileSync(
			process.execPath,
			[path.join(consumer, script), path.join(consumer, `${script}.out`)],
			{ encoding: 'utf8' },
		);
		if (!stdout.includes('PACK_SMOKE_')) {
			throw new Error(`${script} did not print its success marker`);
		}
		console.log(stdout.trim());
	}

	step('checking TypeScript declarations are shipped');
	if (!fs.existsSync(path.join(consumer, 'node_modules/pino-quiet/dist/index.d.ts'))) {
		throw new Error('dist/index.d.ts missing from the tarball');
	}

	const nodeMajor = Number(process.versions.node.split('.')[0]);
	if (nodeMajor >= 22) {
		// require(esm) interop is only valid on Node >= 22.12 (unflagged);
		// the require-interop.cjs run above covers it on supported runners.
		step(`require(esm) interop verified on Node ${process.versions.node}`);
	} else {
		step(`skipping require(esm) interop claim on Node ${process.versions.node} (< 22.12)`);
	}

	console.log('PACK_SMOKE_ALL_OK');
} finally {
	fs.rmSync(workDir, { recursive: true, force: true });
}

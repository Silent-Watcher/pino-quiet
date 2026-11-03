#!/usr/bin/env node
/**
 * Performance benchmark for pino-quiet (Phase 4 tooling, dev-only).
 *
 * Deterministic datasets (seeded PRNG), real Pino worker transports for the
 * end-to-end scenarios, direct factory invocation for the comparator
 * scenario. Prints a table and writes machine-readable JSON to
 * bench/results/. Results are machine-specific: only compare before/after
 * runs on the same machine, never across machines.
 *
 * Usage: node scripts/benchmark.mjs [totalLines]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { Deduper } from '../dist/deduper.js';
import { resolveOptions } from '../dist/utils.js';

const TOTAL = Number(process.argv[2] ?? 100_000);
const REPEAT = 3; // inner repetitions per scenario; median reported
const RESULTS_DIR = path.resolve('bench/results');

// The repo does not contain node_modules/pino-quiet (it is the package
// itself). Pino's target resolution and bare imports both need it, so
// mimic a consumer install with a symlink into the project root.
const selfLink = path.resolve('node_modules/pino-quiet');
if (!fs.existsSync(selfLink)) {
	fs.symlinkSync('..', selfLink, 'dir');
}

/** Deterministic PRNG so every run feeds identical input. */
function makeRng(seed) {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 0xffffffff;
	};
}

/**
 * Builds a deterministic NDJSON dataset: `unique` distinct messages, each
 * repeated `runs` times consecutively. `runs: 10` produces 90% consecutive
 * duplicates (cycling unique messages would produce none to collapse);
 * `runs: 1` produces an all-unique stream.
 */
function buildDataset(unique, runs, metadata) {
	const lines = [];
	const big = 'x'.repeat(1024);
	for (let i = 0; i < unique; i++) {
		for (let rep = 0; rep < runs; rep++) {
			const record = {
				level: 30,
				time: 1_700_000_000_000 + i,
				pid: 1,
				hostname: 'bench',
				msg: `message number ${i}`,
			};
			if (metadata === 'small') record.id = i;
			if (metadata === 'large') record.payload = { blob: big, n: i };
			lines.push(JSON.stringify(record));
		}
	}
	return lines;
}

const datasets = {
	allUnique: buildDataset(1000, 1),
	consecutiveRuns: buildDataset(100, 10),
	oneUnique: buildDataset(1, 1),
	smallMeta: buildDataset(1000, 1, 'small'),
	largeMeta: buildDataset(1000, 1, 'large'),
};
const datasetFiles = {};
for (const [name, lines] of Object.entries(datasets)) {
	datasetFiles[name] = path.join(os.tmpdir(), `pino-quiet-bench-${name}.ndjson`);
	fs.writeFileSync(datasetFiles[name], lines.join('\n'));
}
const avgLineLen = {};
for (const [name, lines] of Object.entries(datasets)) {
	avgLineLen[name] = lines.join('\n').length / lines.length;
}

/**
 * Runs one scenario in a fresh child process: streams `total` lines through
 * the configured transport and reports timing/CPU/output metrics as JSON.
 */
function runScenario(cfg, datasetFile, total) {
	const child = `
		import fs from 'node:fs';
		import { once } from 'node:events';
		import pino from 'pino';
		import pinoQuiet from 'pino-quiet';
		const { cfg, datasetFile, outFile, total } = JSON.parse(process.argv[2]);
		const lines = fs.readFileSync(datasetFile, 'utf8').split('\\n').filter(Boolean);
		// Feed structured objects (as real pino callers do): feeding raw NDJSON
		// strings as the log message would make every line unique and defeat
		// the very dedup behavior being measured.
		const objects = lines.map((l) => JSON.parse(l));
		let transport;
		if (cfg.direct) {
			// direct factory invocation: the only path where callbacks (comparator) work
			transport = await pinoQuiet({ ...cfg.options, destination: outFile });
		} else {
			if (cfg.transport.target) {
				cfg.transport.options = { ...cfg.transport.options, destination: outFile };
			} else if (cfg.transport.pipeline) {
				const last = cfg.transport.pipeline[cfg.transport.pipeline.length - 1];
				last.options = { ...last.options, destination: outFile };
			}
			transport = pino.transport(cfg.transport);
		}
		const logger = cfg.direct ? null : pino(transport);
		if (!cfg.direct) await new Promise((r) => transport.on('ready', r));
		const cpu0 = process.cpuUsage();
		const mem0 = process.memoryUsage();
		const t0 = performance.now();
		if (cfg.direct) {
			for (let i = 0; i < total; i++) transport.write(lines[i % lines.length]);
			transport.end();
			await once(transport, 'close');
		} else {
			for (let i = 0; i < total; i++) logger.info(objects[i % objects.length]);
			// thread-stream's flush acks that the worker drained its buffer to
			// the destination; its 'close'/'end' events are unreliable at high
			// volume, so flush is the completion signal we measure against.
			await logger.flush();
			const t1 = performance.now();
			const cpu1 = process.cpuUsage(cpu0);
			const mem1 = process.memoryUsage();
			const outBytes = fs.existsSync(outFile) ? fs.statSync(outFile).size : 0;
			console.log(JSON.stringify({
				wallMs: t1 - t0,
				userCpuMs: cpu1.user / 1000,
				systemCpuMs: cpu1.system / 1000,
				heapDeltaMb: (mem1.heapUsed - mem0.heapUsed) / 1048576,
				outBytes,
			}));
			process.exit(0);
		}
		const t1 = performance.now();
		const cpu1 = process.cpuUsage(cpu0);
		const mem1 = process.memoryUsage();
		const outBytes = fs.existsSync(outFile) ? fs.statSync(outFile).size : 0;
		console.log(JSON.stringify({
			wallMs: t1 - t0,
			userCpuMs: cpu1.user / 1000,
			systemCpuMs: cpu1.system / 1000,
			heapDeltaMb: (mem1.heapUsed - mem0.heapUsed) / 1048576,
			outBytes,
		}));
	`;

	// The child entry lives inside the project so bare imports (pino,
	// pino-quiet self-reference) resolve against this repo's node_modules.
	const entryDir = path.resolve('node_modules/.pino-quiet-bench');
	fs.mkdirSync(entryDir, { recursive: true });
	const entry = path.join(entryDir, `child-${Date.now()}-${Math.random()}.mjs`);
	fs.writeFileSync(entry, child);
	const outFile = path.join(os.tmpdir(), `pq-bench-out-${Date.now()}-${Math.random()}.log`);
	const payload = JSON.stringify({ cfg, datasetFile, outFile, total });
	try {
		const stdout = execFileSync(process.execPath, [entry, payload], {
			cwd: process.cwd(),
			encoding: 'utf8',
			timeout: 300000,
		});
		const metrics = JSON.parse(stdout.trim().split('\n').pop());
		// Stat the output in the parent: the child exits right after the
		// flush ack, which can race the worker's last buffered fs write.
		metrics.outBytes = fs.existsSync(outFile) ? fs.statSync(outFile).size : 0;
		return metrics;
	} finally {
		fs.rmSync(entry, { force: true });
	}
}

function quietWorker(options) {
	return { transport: { target: 'pino-quiet', options } };
}

/**
 * Deduper-level microbenchmark: measures pino-quiet's own comparison cost
 * without stream overhead. Used for the comparison-mode scenarios, because
 * driving a full direct-mode transport synchronously floods pino's split2
 * input stream (upstream, shared by every transport) and drowns the signal.
 */
function deduperBench(options, lines, total) {
	const objects = lines.map((l) => JSON.parse(l));
	const d = new Deduper(resolveOptions({ flushIntervalMs: 0, ...options }), () => {});
	const t0 = performance.now();
	for (let i = 0; i < total; i++) d.ingest(objects[i % objects.length]);
	return {
		wallMs: performance.now() - t0,
		userCpuMs: 0,
		systemCpuMs: 0,
		heapDeltaMb: 0,
		outBytes: 0,
	};
}

const SCENARIOS = [
	{
		name: '01 baseline: standard pino (pino/file)',
		cfg: { transport: { target: 'pino/file' } },
		dataset: 'allUnique',
	},
	{
		name: '02 quiet, all unique (no duplicates)',
		cfg: quietWorker({ flushIntervalMs: 0 }),
		dataset: 'allUnique',
	},
	{
		name: '03 quiet, fully repeated (1 unique msg)',
		cfg: quietWorker({ flushIntervalMs: 0 }),
		dataset: 'oneUnique',
	},
	{
		name: '04 quiet, partially repeated (1% unique)',
		cfg: quietWorker({ flushIntervalMs: 0 }),
		dataset: 'consecutiveRuns',
	},
	{
		name: '05 quiet, strict comparison, all unique',
		cfg: quietWorker({ flushIntervalMs: 0, strict: true }),
		dataset: 'allUnique',
	},
	{
		name: '06 quiet, strict comparison, fully repeated',
		cfg: quietWorker({ flushIntervalMs: 0, strict: true }),
		dataset: 'oneUnique',
	},
	{
		name: '07 comparison modes (Deduper microbench): simple',
		dataset: 'consecutiveRuns',
		microbench: { options: {} },
	},
	{
		name: '08 comparison modes (Deduper microbench): strict',
		dataset: 'consecutiveRuns',
		microbench: { options: { strict: true } },
	},
	{
		name: '09 comparison modes (Deduper microbench): custom comparator',
		dataset: 'consecutiveRuns',
		microbench: { options: { comparator: (a, b) => a.msg === b.msg } },
	},
	{
		name: '10 quiet, small metadata objects (strict)',
		cfg: quietWorker({ flushIntervalMs: 0, strict: true }),
		dataset: 'smallMeta',
	},
	{
		name: '11 quiet, large metadata objects 1KB (strict)',
		cfg: quietWorker({ flushIntervalMs: 0, strict: true }),
		dataset: 'largeMeta',
	},
	{
		name: '12 quiet, default flushIntervalMs (5000ms)',
		cfg: quietWorker({ flushIntervalMs: 5000, maxRepeats: 1_000_000 }),
		dataset: 'allUnique',
	},
	{
		name: '13 quiet, high volume (10x lines)',
		cfg: quietWorker({ flushIntervalMs: 0 }),
		dataset: 'allUnique',
		totalMultiplier: 10,
	},
	{
		name: '14 quiet, pipeline mode (quiet -> pino/file)',
		cfg: {
			transport: {
				pipeline: [
					{ target: 'pino-quiet', options: { pipeline: true, flushIntervalMs: 0 } },
					{ target: 'pino/file' },
				],
			},
		},
		dataset: 'consecutiveRuns',
	},
];

const results = [];
for (const scenario of SCENARIOS) {
	console.error(`running: ${scenario.name}`);
	const total = TOTAL * (scenario.totalMultiplier ?? 1);
	const runs = [];
	for (let i = 0; i < REPEAT; i++) {
		if (scenario.microbench) {
			runs.push(deduperBench(scenario.microbench.options, datasets[scenario.dataset], total));
			continue;
		}
		runs.push(runScenario(scenario.cfg, datasetFiles[scenario.dataset], total));
	}
	runs.sort((a, b) => a.wallMs - b.wallMs);
	const median = runs[Math.floor(runs.length / 2)];
	const inputBytes = total * avgLineLen[scenario.dataset];
	results.push({
		scenario: scenario.name,
		totalLines: total,
		wallMs: Math.round(median.wallMs),
		logsPerSecond: Math.round(total / (median.wallMs / 1000)),
		userCpuMs: Math.round(median.userCpuMs),
		systemCpuMs: Math.round(median.systemCpuMs),
		heapDeltaMb: Math.round(median.heapDeltaMb * 10) / 10,
		outBytes: median.outBytes,
		inputBytes: Math.round(inputBytes),
		outputReductionRatio:
			median.outBytes > 0 ? Math.round((1 - median.outBytes / inputBytes) * 1000) / 1000 : 0,
	});
	console.log(
		`${scenario.name.padEnd(50)} ${String(results.at(-1).logsPerSecond).padStart(10)} logs/s  ${String(results.at(-1).wallMs).padStart(7)} ms`,
	);
}

const report = {
	date: new Date().toISOString(),
	node: process.version,
	pino: JSON.parse(fs.readFileSync('node_modules/pino/package.json', 'utf8')).version,
	pinoQuiet: JSON.parse(fs.readFileSync('package.json', 'utf8')).version,
	totalLinesPerScenario: TOTAL,
	repetitions: REPEAT,
	machine: `${os.cpus().length} cores, ${os.arch()}, ${os.platform()} ${os.release()}`,
	seed: 42,
	note: 'wall-clock and cpuUsage are measured inside the worker child; heap delta covers the main process only',
	results,
};

fs.mkdirSync(RESULTS_DIR, { recursive: true });
const outFile = path.join(RESULTS_DIR, `bench-${report.date.replaceAll(/[:.]/g, '-')}.json`);
fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nresults written to ${path.relative(process.cwd(), outFile)}`);

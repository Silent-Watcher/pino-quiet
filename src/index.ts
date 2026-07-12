import { once } from 'node:events';
import { pipeline as streamPipeline, Transform } from 'node:stream';
import build from 'pino-abstract-transport';
import SonicBoom from 'sonic-boom';
import { Deduper } from './deduper';
import { resolveOptions } from './utils';

export type {
	FlushMeta,
	LogRecord,
	PinoQuietOptions,
	ResolvedOptions,
} from './types.ts';

/**
 * Builds a "terminal" transport: pino-quiet owns a SonicBoom destination and
 * writes collapsed NDJSON lines directly to it. This is the classic,
 * backward-compatible mode (`{ target: 'pino-quiet' }` as the whole
 * transport, or the last stage of a `pipeline`).
 */
function buildDestinationTransport(opts: ReturnType<typeof resolveOptions>) {
	const dest = new SonicBoom({
		dest: opts.destination,
		sync: opts.sync,
		mkdir: opts.mkdir,
		append: opts.append,
	});

	// Prevent an unhandled 'error' from crashing the whole process; surface
	// it on stderr instead so operators can see it in logs/monitoring.
	dest.on('error', (err) => {
		process.stderr.write(
			`pino-quiet: destination write error: ${err?.stack ?? String(err)}\n`,
		);
	});

	const deduper = new Deduper(opts, (line) => {
		dest.write(line);
	});

	return build(
		async (source) => {
			for await (const obj of source) {
				deduper.ingest(obj);
			}
		},
		{
			// `close` is the single place responsible for flushing whatever is
			// still buffered and tearing down the destination. Doing this in
			// *both* the loop and here would race `dest.end()` against itself.
			close: async () => {
				deduper.flush();
				deduper.destroy();
				dest.end();
				await once(dest, 'close');
			},
		},
	);
}

/**
 * Builds a pass-through Transform: pino-quiet collapses duplicates and
 * pushes the resulting NDJSON downstream instead of writing anywhere
 * itself. This is what makes it composable as a stage *before*
 * `pino-pretty` (or any other transport) in:
 *
 * ```js
 * pino.transport({
 *   pipeline: [
 *     { target: 'pino-quiet', options: { pipeline: true } },
 *     { target: 'pino-pretty' },
 *   ],
 * })
 * ```
 */
function buildPipelineTransform(opts: ReturnType<typeof resolveOptions>) {
	// Declared before the Deduper so its emit callback can close over it —
	// it is only ever invoked after `transform` has been assigned below.
	let transform!: Transform;

	const deduper = new Deduper(opts, (line) => {
		transform.push(line);
	});

	transform = new Transform({
		objectMode: true,
		autoDestroy: true,
		transform(chunk, _enc, callback) {
			deduper.ingest(chunk);
			callback();
		},
		flush(callback) {
			deduper.flush();
			callback();
		},
	});

	return build(
		(source) => {
			streamPipeline(source, transform, () => {
				/* errors, if any, surface via the transform's own 'error' event */
			});
			return transform;
		},
		{
			enablePipelining: true,
			close(_err, callback) {
				deduper.destroy();
				callback();
			},
		},
	);
}

export default async function pinoQuiet(
	rawOpts: import('./types.ts').PinoQuietOptions = {},
) {
	const opts = resolveOptions(rawOpts);
	return opts.pipeline
		? buildPipelineTransform(opts)
		: buildDestinationTransport(opts);
}

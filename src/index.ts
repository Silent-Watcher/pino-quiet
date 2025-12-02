import { once } from 'node:events';
import equal from 'fast-deep-equal';
import build from 'pino-abstract-transport';
import SonicBoom from 'sonic-boom';

export interface PinoQuietOptions {
	// Destination file descriptor or path. Defaults to 1 (stdout).
	destination?: string | number;

	// If true, compares the entire log object (excluding time/pid).
	// If false (default), only compares the 'msg' string.
	strict?: boolean;

	// The field name to inject the repetition count into. Defaults to 'repeats'.
	countField?: string;
}

// Helper to strip volatile fields (time, pid, hostname) for strict comparison
const getComparable = (obj: any) => {
	const { _time, _pid, _hostname, ...rest } = obj;
	return rest;
};

export default async function pinoQuiet(opts: PinoQuietOptions = {}) {
	// defaulting options
	const dest = new SonicBoom({ dest: opts.destination || 1, sync: false });
	const countField = opts.countField || 'repeats';
	const isStrict = opts.strict || false;

	// STATE MANAGEMENT
	// We hold the last log in memory to compare against the incoming one.
	let lastLog: any = null;
	let lastLogComparable: any = null; // Optimized version for comparison
	let repeatCount = 0;

	// Internal function to flush the buffer to the output stream
	const flushLastLog = () => {
		if (lastLog) {
			if (repeatCount > 0) {
				// Inject the repetition count into the log object
				lastLog[countField] = repeatCount + 1;

				// Optional: Modify message to make it obvious visually
				if (typeof lastLog.msg === 'string') {
					lastLog.msg = `${lastLog.msg} (x${repeatCount + 1})`;
				}
			}

			// Write to the destination (usually stdout)
			// We stringify here because SonicBoom expects a string for writing
			dest.write(`${JSON.stringify(lastLog)}]\n`);
		}
		// Reset state
		lastLog = null;
		lastLogComparable = null;
		repeatCount = 0;
	};

	// Build the transport using pino-abstract-transport
	// source is an AsyncIterable of log lines
	return build(
		async (source) => {
			for await (const obj of source) {
				// 1. Determine comparison basis
				// If strict, we look at the whole object minus timestamps.
				// If not strict, we just check if the message string is identical.
				const currentComparable = isStrict
					? getComparable(obj)
					: obj.msg;

				// 2. Comparison Logic
				if (lastLog && equal(lastLogComparable, currentComparable)) {
					// It's a duplicate! Don't write yet, just increment.
					repeatCount++;
				} else {
					// It's different (or the first log).
					// Flush the previous one (if it exists) and store this new one.
					flushLastLog();

					lastLog = obj;
					lastLogComparable = currentComparable;
				}
			}

			// 3. Cleanup
			// The stream has ended (application shutting down).
			// Ensure the final pending log is written.
			flushLastLog();

			// Close the destination stream properly
			if (dest) {
				dest.end();
				await once(dest, 'close');
			}
		},

		{
			// This allows the transport to clean up properly on exit
			close: async (_err, _cb) => {
				flushLastLog();
				dest.end();
			},
		},
	);
}

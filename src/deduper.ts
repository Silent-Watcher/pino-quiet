import type { LogRecord, ResolvedOptions } from './types.ts';
import { isDuplicate } from './utils.ts';

/**
 * Framework-agnostic collapsing engine. Both the "destination" transport
 * (writes to its own SonicBoom) and the "pipeline" transform (pushes
 * downstream) delegate to this class, so the actual dedup/flush/timer logic
 * only has to be implemented and tested once.
 */
export class Deduper {
	private readonly opts: ResolvedOptions;
	private readonly emit: (line: string) => void;

	private bufferedLog: LogRecord | null = null;
	private repeatCount = 0;
	private firstSeen = 0;
	private lastSeen = 0;
	private timer: ReturnType<typeof setTimeout> | null = null;

	constructor(opts: ResolvedOptions, emit: (line: string) => void) {
		this.opts = opts;
		this.emit = emit;
	}

	/** Feed a newly-parsed log object into the deduper. */
	ingest(obj: LogRecord): void {
		const now = Date.now();

		if (this.bufferedLog && isDuplicate(this.bufferedLog, obj, this.opts)) {
			this.repeatCount++;
			this.lastSeen = now;

			// Force-flush hot loops instead of buffering forever.
			if (this.repeatCount + 1 >= this.opts.maxRepeats) {
				this.flush();
			} else {
				this.armTimer();
			}
			return;
		}

		// Different log (or first ever): flush whatever was pending, buffer new.
		this.flush();
		this.bufferedLog = obj;
		this.repeatCount = 0;
		this.firstSeen = now;
		this.lastSeen = now;
		this.armTimer();
	}

	/** Flush whatever is currently buffered, if anything. Idempotent. */
	flush(): void {
		this.clearTimer();
		if (!this.bufferedLog) return;

		const log = this.bufferedLog;
		const totalOccurrences = this.repeatCount + 1;

		if (totalOccurrences >= this.opts.minRepeatsToAnnotate) {
			if (this.repeatCount > 0) {
				log[this.opts.countField] = totalOccurrences;
				if (this.opts.annotateMessage && typeof log.msg === 'string') {
					log.msg = `${log.msg}${this.opts.suffixFormat(totalOccurrences)}`;
				}
			}
		}

		if (this.opts.includeTimestamps) {
			log[this.opts.firstSeenField] = this.firstSeen;
			log[this.opts.lastSeenField] = this.lastSeen;
		}

		if (this.opts.onFlush) {
			try {
				this.opts.onFlush(log, {
					repeats: totalOccurrences,
					firstSeen: this.firstSeen,
					lastSeen: this.lastSeen,
				});
			} catch (err) {
				process.stderr.write(
					`pino-quiet: onFlush hook threw an error: ${
						(err as Error)?.stack ?? String(err)
					}\n`,
				);
			}
		}

		this.emit(`${JSON.stringify(log)}\n`);

		this.bufferedLog = null;
		this.repeatCount = 0;
		this.firstSeen = 0;
		this.lastSeen = 0;
	}

	/** Clears pending timers. Call on stream close/destroy. */
	destroy(): void {
		this.clearTimer();
	}

	private armTimer(): void {
		this.clearTimer();
		if (this.opts.flushIntervalMs > 0) {
			this.timer = setTimeout(
				() => this.flush(),
				this.opts.flushIntervalMs,
			);
			this.timer.unref?.();
		}
	}

	private clearTimer(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}
}

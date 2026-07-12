import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Deduper } from '../src/deduper';
import { resolveOptions } from '../src/utils';

function emitted(lines: string[]) {
	return lines.map((l) => JSON.parse(l));
}

describe('Deduper', () => {
	it('passes through a single non-repeated log untouched', () => {
		const lines: string[] = [];
		const d = new Deduper(resolveOptions({ flushIntervalMs: 0 }), (l) =>
			lines.push(l),
		);

		d.ingest({ msg: 'hello' });
		d.flush();

		const [log] = emitted(lines);
		expect(log).toEqual({ msg: 'hello' });
		expect(log.repeats).toBeUndefined();
	});

	it('collapses consecutive duplicates and annotates on the flushing log', () => {
		const lines: string[] = [];
		const d = new Deduper(resolveOptions({ flushIntervalMs: 0 }), (l) =>
			lines.push(l),
		);

		d.ingest({ msg: 'Connecting...' });
		d.ingest({ msg: 'Connecting...' });
		d.ingest({ msg: 'Connecting...' });
		d.ingest({ msg: 'Connected!' }); // different -> flushes the group above
		d.flush(); // flush the trailing "Connected!" too

		const logs = emitted(lines);
		expect(logs).toHaveLength(2);
		expect(logs[0]).toMatchObject({
			msg: 'Connecting... (x3)',
			repeats: 3,
		});
		expect(logs[1]).toMatchObject({ msg: 'Connected!' });
		expect(logs[1].repeats).toBeUndefined();
	});

	it('regression: never appends a stray "]" to emitted lines (pre-1.0 bug)', () => {
		const lines: string[] = [];
		const d = new Deduper(resolveOptions({ flushIntervalMs: 0 }), (l) =>
			lines.push(l),
		);
		d.ingest({ msg: 'a' });
		d.flush();
		expect(lines[0]?.trim().endsWith('}')).toBe(true);
		expect(() => JSON.parse(lines[0] ?? '')).not.toThrow();
	});

	it('respects a custom countField', () => {
		const lines: string[] = [];
		const d = new Deduper(
			resolveOptions({ flushIntervalMs: 0, countField: 'hits' }),
			(l) => lines.push(l),
		);
		d.ingest({ msg: 'a' });
		d.ingest({ msg: 'a' });
		d.ingest({ msg: 'b' });
		const [log] = emitted(lines);
		expect(log.hits).toBe(2);
		expect(log.repeats).toBeUndefined();
	});

	it('respects annotateMessage: false (only sets the count field)', () => {
		const lines: string[] = [];
		const d = new Deduper(
			resolveOptions({ flushIntervalMs: 0, annotateMessage: false }),
			(l) => lines.push(l),
		);
		d.ingest({ msg: 'a' });
		d.ingest({ msg: 'a' });
		d.ingest({ msg: 'b' });
		const [log] = emitted(lines);
		expect(log.msg).toBe('a');
		expect(log.repeats).toBe(2);
	});

	it('respects a custom suffixFormat', () => {
		const lines: string[] = [];
		const d = new Deduper(
			resolveOptions({
				flushIntervalMs: 0,
				suffixFormat: (n) => ` [${n}x]`,
			}),
			(l) => lines.push(l),
		);
		d.ingest({ msg: 'a' });
		d.ingest({ msg: 'a' });
		d.ingest({ msg: 'b' });
		const [log] = emitted(lines);
		expect(log.msg).toBe('a [2x]');
	});

	it('honors minRepeatsToAnnotate, skipping annotation below the threshold', () => {
		const lines: string[] = [];
		const d = new Deduper(
			resolveOptions({ flushIntervalMs: 0, minRepeatsToAnnotate: 3 }),
			(l) => lines.push(l),
		);
		d.ingest({ msg: 'a' });
		d.ingest({ msg: 'a' }); // 2 total occurrences, below threshold of 3
		d.ingest({ msg: 'b' });
		const [log] = emitted(lines);
		expect(log.msg).toBe('a');
		expect(log.repeats).toBeUndefined();
	});

	it('force-flushes once maxRepeats is reached, without waiting for a different log', () => {
		const lines: string[] = [];
		const d = new Deduper(
			resolveOptions({ flushIntervalMs: 0, maxRepeats: 3 }),
			(l) => lines.push(l),
		);
		d.ingest({ msg: 'a' });
		d.ingest({ msg: 'a' });
		d.ingest({ msg: 'a' }); // hits cap of 3 total occurrences -> auto flush
		expect(lines).toHaveLength(1);
		expect(emitted(lines)[0]).toMatchObject({ msg: 'a (x3)', repeats: 3 });

		// A further duplicate starts a fresh batch rather than growing forever.
		d.ingest({ msg: 'a' });
		d.flush();
		expect(lines).toHaveLength(2);
		expect(emitted(lines)[1]).toMatchObject({ msg: 'a' });
	});

	it('includes firstSeen/lastSeen timestamps when includeTimestamps is enabled', () => {
		const lines: string[] = [];
		const d = new Deduper(
			resolveOptions({ flushIntervalMs: 0, includeTimestamps: true }),
			(l) => lines.push(l),
		);
		d.ingest({ msg: 'a' });
		d.ingest({ msg: 'a' });
		d.flush();
		const [log] = emitted(lines);
		expect(typeof log.firstSeen).toBe('number');
		expect(typeof log.lastSeen).toBe('number');
		expect(log.lastSeen).toBeGreaterThanOrEqual(log.firstSeen);
	});

	it('uses custom field names for the timestamps when configured', () => {
		const lines: string[] = [];
		const d = new Deduper(
			resolveOptions({
				flushIntervalMs: 0,
				includeTimestamps: true,
				firstSeenField: 'batchStart',
				lastSeenField: 'batchEnd',
			}),
			(l) => lines.push(l),
		);
		d.ingest({ msg: 'a' });
		d.flush();
		const [log] = emitted(lines);
		expect(log).toHaveProperty('batchStart');
		expect(log).toHaveProperty('batchEnd');
	});

	it('invokes onFlush with the emitted log and repeat metadata', () => {
		const seen: Array<{ log: unknown; meta: unknown }> = [];
		const d = new Deduper(
			resolveOptions({
				flushIntervalMs: 0,
				onFlush: (log, meta) => seen.push({ log, meta }),
			}),
			() => {},
		);
		d.ingest({ msg: 'a' });
		d.ingest({ msg: 'a' });
		d.flush();
		expect(seen).toHaveLength(1);
		expect(seen[0]?.meta).toMatchObject({ repeats: 2 });
	});

	it('does not let a throwing onFlush hook break emission', () => {
		const lines: string[] = [];
		const d = new Deduper(
			resolveOptions({
				flushIntervalMs: 0,
				onFlush: () => {
					throw new Error('boom');
				},
			}),
			(l) => lines.push(l),
		);
		expect(() => {
			d.ingest({ msg: 'a' });
			d.flush();
		}).not.toThrow();
		expect(lines).toHaveLength(1);
	});

	it('applies a custom comparator instead of strict/simple matching', () => {
		const lines: string[] = [];
		const d = new Deduper(
			resolveOptions({
				flushIntervalMs: 0,
				comparator: (
					a: Record<string, unknown>,
					b: Record<string, unknown>,
				) => a.code === b.code,
			}),
			(l) => lines.push(l),
		);
		d.ingest({ code: 1, msg: 'first phrasing' });
		d.ingest({ code: 1, msg: 'second phrasing' });
		d.ingest({ code: 2, msg: 'third phrasing' });
		const logs = emitted(lines);
		expect(logs).toHaveLength(1);
		expect(logs[0]).toMatchObject({ repeats: 2 });
	});
});

describe('Deduper timers', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('auto-flushes a stale buffered log after flushIntervalMs of silence', () => {
		const lines: string[] = [];
		const d = new Deduper(resolveOptions({ flushIntervalMs: 1000 }), (l) =>
			lines.push(l),
		);

		d.ingest({ msg: 'a' });
		d.ingest({ msg: 'a' });
		expect(lines).toHaveLength(0);

		vi.advanceTimersByTime(999);
		expect(lines).toHaveLength(0);

		vi.advanceTimersByTime(2);
		expect(lines).toHaveLength(1);
		expect(emitted(lines)[0]).toMatchObject({ repeats: 2 });

		d.destroy();
	});

	it('does not auto-flush when flushIntervalMs is 0 (disabled)', () => {
		const lines: string[] = [];
		const d = new Deduper(resolveOptions({ flushIntervalMs: 0 }), (l) =>
			lines.push(l),
		);
		d.ingest({ msg: 'a' });
		vi.advanceTimersByTime(60_000);
		expect(lines).toHaveLength(0);
		d.destroy();
	});

	it('destroy() clears pending timers so they cannot fire later', () => {
		const lines: string[] = [];
		const d = new Deduper(resolveOptions({ flushIntervalMs: 500 }), (l) =>
			lines.push(l),
		);
		d.ingest({ msg: 'a' });
		d.destroy();
		vi.advanceTimersByTime(10_000);
		expect(lines).toHaveLength(0);
	});
});

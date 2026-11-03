import { afterEach, describe, expect, it, vi } from 'vitest';
import { Deduper } from '../src/deduper';
import { getComparable, isDuplicate, resolveOptions } from '../src/utils';

/**
 * Captures stderr writes for assertions and restores the original after
 * each test (several error policies report to stderr instead of throwing).
 */
function captureStderr(): { lines: string[]; restore: () => void } {
	const lines: string[] = [];
	const spy = vi.spyOn(process.stderr, 'write').mockImplementation(((
		chunk: unknown,
	) => {
		lines.push(String(chunk));
		return true;
	}) as typeof process.stderr.write);
	return { lines, restore: () => spy.mockRestore() };
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('option validation (JS consumers bypassing TS types)', () => {
	it('throws a RangeError for NaN maxRepeats (previously accepted)', () => {
		expect(() => resolveOptions({ maxRepeats: Number.NaN })).toThrow(
			RangeError,
		);
	});

	it('throws a RangeError for a non-number maxRepeats', () => {
		expect(() =>
			resolveOptions({ maxRepeats: '3' as unknown as number }),
		).toThrow(RangeError);
	});

	it('still accepts Infinity as maxRepeats (documented default)', () => {
		expect(
			resolveOptions({ maxRepeats: Number.POSITIVE_INFINITY }).maxRepeats,
		).toBe(Number.POSITIVE_INFINITY);
	});

	it('throws a RangeError for NaN flushIntervalMs (previously setTimeout-coerced)', () => {
		expect(() => resolveOptions({ flushIntervalMs: Number.NaN })).toThrow(
			RangeError,
		);
	});

	it('throws a RangeError for a non-number flushIntervalMs', () => {
		expect(() =>
			resolveOptions({ flushIntervalMs: '1000' as unknown as number }),
		).toThrow(RangeError);
	});

	it('still accepts 0 flushIntervalMs (disabled timer)', () => {
		expect(resolveOptions({ flushIntervalMs: 0 }).flushIntervalMs).toBe(0);
	});

	it('throws a RangeError for NaN minRepeatsToAnnotate', () => {
		expect(() =>
			resolveOptions({ minRepeatsToAnnotate: Number.NaN }),
		).toThrow(RangeError);
	});

	it('throws a TypeError for a non-function comparator', () => {
		expect(() =>
			resolveOptions({ comparator: 'x' as unknown as () => boolean }),
		).toThrow(TypeError);
	});

	it('throws a TypeError for a non-function suffixFormat', () => {
		expect(() =>
			resolveOptions({
				suffixFormat: 42 as unknown as (c: number) => string,
			}),
		).toThrow(TypeError);
	});

	it('throws a TypeError for a non-function onFlush', () => {
		expect(() =>
			resolveOptions({ onFlush: true as unknown as () => void }),
		).toThrow(TypeError);
	});

	it('throws a TypeError for a non-array ignoreKeys', () => {
		expect(() =>
			resolveOptions({ ignoreKeys: 'time' as unknown as string[] }),
		).toThrow(TypeError);
	});

	it('throws a TypeError for non-string ignoreKeys entries', () => {
		expect(() =>
			resolveOptions({ ignoreKeys: [1] as unknown as string[] }),
		).toThrow(TypeError);
	});

	it('throws a TypeError for an empty countField', () => {
		expect(() => resolveOptions({ countField: '' })).toThrow(TypeError);
	});

	it('throws a TypeError for __proto__ as countField', () => {
		expect(() => resolveOptions({ countField: '__proto__' })).toThrow(
			TypeError,
		);
	});

	it('throws a TypeError for __proto__ as firstSeenField', () => {
		expect(() => resolveOptions({ firstSeenField: '__proto__' })).toThrow(
			TypeError,
		);
	});

	it('throws a TypeError for __proto__ as lastSeenField', () => {
		expect(() => resolveOptions({ lastSeenField: '__proto__' })).toThrow(
			TypeError,
		);
	});

	it('keeps accepting all valid documented configurations', () => {
		expect(() =>
			resolveOptions({
				destination: '/tmp/x.log',
				strict: true,
				countField: 'hits',
				ignoreKeys: ['requestId'],
				levelAware: true,
				caseInsensitive: true,
				maxRepeats: 10,
				flushIntervalMs: 100,
				minRepeatsToAnnotate: 2,
				annotateMessage: false,
				includeTimestamps: true,
				firstSeenField: 'a',
				lastSeenField: 'b',
				pipeline: true,
				mkdir: true,
				append: false,
				sync: true,
			}),
		).not.toThrow();
	});
});

describe('comparison safety (special keys and values)', () => {
	it('regression: own __proto__ keys participate in strict comparison instead of mutating the prototype', () => {
		const a: Record<string, unknown> = JSON.parse(
			'{"__proto__":{"x":1},"msg":"a"}',
		);
		const b: Record<string, unknown> = JSON.parse(
			'{"__proto__":{"x":2},"msg":"a"}',
		);
		const opts = {
			...resolveOptions({ strict: true }),
			comparator: undefined,
		};
		expect(isDuplicate(a, b, opts)).toBe(false);
		expect(
			isDuplicate(a, JSON.parse('{"__proto__":{"x":1},"msg":"a"}'), opts),
		).toBe(true);
	});

	it('regression: __proto__ own key does not pollute the comparable object', () => {
		const record: Record<string, unknown> = JSON.parse(
			'{"__proto__":1,"msg":"a"}',
		);
		const comparable = getComparable(record, ['time', 'pid', 'hostname']);
		expect(Object.getPrototypeOf(comparable)).toBe(Object.prototype);
		expect(Object.keys(comparable).sort()).toEqual(['__proto__', 'msg']);
	});

	it('treats a missing msg on both sides as a duplicate in simple mode', () => {
		const opts = { ...resolveOptions(), comparator: undefined };
		expect(isDuplicate({}, {}, opts)).toBe(true);
	});

	it('does not match a present msg against a missing msg in simple mode', () => {
		const opts = { ...resolveOptions(), comparator: undefined };
		expect(isDuplicate({ msg: 'a' }, {}, opts)).toBe(false);
	});

	it('does not match null/undefined msg values in simple mode', () => {
		const opts = { ...resolveOptions(), comparator: undefined };
		expect(isDuplicate({ msg: null }, { msg: 'a' }, opts)).toBe(false);
	});

	it('deep-compares non-string msg values (nested objects and arrays)', () => {
		const opts = { ...resolveOptions(), comparator: undefined };
		expect(
			isDuplicate(
				{ msg: { list: [1, { deep: 'x' }] } },
				{ msg: { list: [1, { deep: 'x' }] } },
				opts,
			),
		).toBe(true);
		expect(
			isDuplicate(
				{ msg: { list: [1, { deep: 'x' }] } },
				{ msg: { list: [1, { deep: 'y' }] } },
				opts,
			),
		).toBe(false);
	});
});

describe('callback error policy', () => {
	it('regression: a throwing comparator does not crash ingest and preserves the pending batch', () => {
		const stderr = captureStderr();
		const lines: string[] = [];
		const d = new Deduper(
			resolveOptions({
				flushIntervalMs: 0,
				comparator: () => {
					throw new Error('cmp boom');
				},
			}),
			(l) => lines.push(l),
		);

		d.ingest({ msg: 'a' });
		expect(() => d.ingest({ msg: 'a' })).not.toThrow();

		// The pending batch was flushed (not a duplicate on comparator failure).
		expect(lines).toHaveLength(1);
		expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({ msg: 'a' });
		expect(stderr.lines.join('')).toContain('comparator threw an error');
		expect(stderr.lines.join('')).toContain('cmp boom');

		// Processing continues with the new record buffered.
		d.flush();
		expect(lines).toHaveLength(2);
		expect(JSON.parse(lines[1] ?? '{}')).toMatchObject({ msg: 'a' });
	});

	it('regression: a throwing suffixFormat still emits the log with the count field', () => {
		const stderr = captureStderr();
		const lines: string[] = [];
		const d = new Deduper(
			resolveOptions({
				flushIntervalMs: 0,
				suffixFormat: () => {
					throw new Error('suffix boom');
				},
			}),
			(l) => lines.push(l),
		);

		d.ingest({ msg: 'a' });
		d.ingest({ msg: 'a' });
		d.flush();

		expect(lines).toHaveLength(1);
		const log = JSON.parse(lines[0] ?? '{}');
		expect(log).toMatchObject({ msg: 'a', repeats: 2 });
		expect(stderr.lines.join('')).toContain(
			'suffixFormat hook threw an error',
		);
		expect(stderr.lines.join('')).toContain('suffix boom');
	});
});

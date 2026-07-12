import { describe, expect, it } from 'vitest';
import { getComparable, isDuplicate, resolveOptions } from '../src/utils.ts';

describe('resolveOptions', () => {
	it('applies documented defaults when no options are given', () => {
		const resolved = resolveOptions();
		expect(resolved.destination).toBe(1);
		expect(resolved.strict).toBe(false);
		expect(resolved.countField).toBe('repeats');
		expect(resolved.ignoreKeys).toEqual(['time', 'pid', 'hostname']);
		expect(resolved.levelAware).toBe(false);
		expect(resolved.caseInsensitive).toBe(false);
		expect(resolved.maxRepeats).toBe(Number.POSITIVE_INFINITY);
		expect(resolved.flushIntervalMs).toBe(5000);
		expect(resolved.minRepeatsToAnnotate).toBe(1);
		expect(resolved.annotateMessage).toBe(true);
		expect(resolved.includeTimestamps).toBe(false);
		expect(resolved.pipeline).toBe(false);
	});

	it('merges user ignoreKeys with the built-in defaults (does not replace)', () => {
		const resolved = resolveOptions({ ignoreKeys: ['requestId'] });
		expect(resolved.ignoreKeys.sort()).toEqual(
			['time', 'pid', 'hostname', 'requestId'].sort(),
		);
	});

	it('deduplicates ignoreKeys if user re-specifies a default key', () => {
		const resolved = resolveOptions({ ignoreKeys: ['time', 'requestId'] });
		expect(resolved.ignoreKeys.sort()).toEqual(
			['time', 'pid', 'hostname', 'requestId'].sort(),
		);
	});

	it('throws for an invalid maxRepeats', () => {
		expect(() => resolveOptions({ maxRepeats: 0 })).toThrow(RangeError);
	});

	it('throws for a negative flushIntervalMs', () => {
		expect(() => resolveOptions({ flushIntervalMs: -1 })).toThrow(
			RangeError,
		);
	});

	it('throws for an invalid minRepeatsToAnnotate', () => {
		expect(() => resolveOptions({ minRepeatsToAnnotate: 0 })).toThrow(
			RangeError,
		);
	});

	it('uses a custom suffixFormat when provided', () => {
		const resolved = resolveOptions({
			suffixFormat: (count) => ` [seen ${count}x]`,
		});
		expect(resolved.suffixFormat(4)).toBe(' [seen 4x]');
	});

	it('defaults suffixFormat to the classic "(xN)" format', () => {
		const resolved = resolveOptions();
		expect(resolved.suffixFormat(3)).toBe(' (x3)');
	});
});

describe('getComparable', () => {
	it('strips ignored keys', () => {
		const result = getComparable(
			{ time: 1, pid: 2, hostname: 'h', msg: 'hi', extra: 'x' },
			['time', 'pid', 'hostname'],
		);
		expect(result).toEqual({ msg: 'hi', extra: 'x' });
	});
});

describe('isDuplicate', () => {
	const baseOpts = {
		comparator: undefined,
		levelAware: false,
		strict: false,
		ignoreKeys: ['time', 'pid', 'hostname'],
		caseInsensitive: false,
	};

	it('matches identical msg strings in simple mode', () => {
		expect(isDuplicate({ msg: 'a' }, { msg: 'a' }, baseOpts)).toBe(true);
	});

	it('does not match different msg strings in simple mode', () => {
		expect(isDuplicate({ msg: 'a' }, { msg: 'b' }, baseOpts)).toBe(false);
	});

	it('respects caseInsensitive', () => {
		expect(
			isDuplicate(
				{ msg: 'Hello' },
				{ msg: 'hello' },
				{ ...baseOpts, caseInsensitive: true },
			),
		).toBe(true);
		expect(
			isDuplicate(
				{ msg: 'Hello' },
				{ msg: 'hello' },
				{ ...baseOpts, caseInsensitive: false },
			),
		).toBe(false);
	});

	it('ignores volatile fields in strict mode', () => {
		expect(
			isDuplicate(
				{ time: 1, pid: 10, hostname: 'a', id: 1 },
				{ time: 2, pid: 11, hostname: 'b', id: 1 },
				{ ...baseOpts, strict: true },
			),
		).toBe(true);
	});

	it('detects differences in strict mode', () => {
		expect(
			isDuplicate(
				{ time: 1, id: 1 },
				{ time: 2, id: 2 },
				{ ...baseOpts, strict: true },
			),
		).toBe(false);
	});

	it('respects extra ignoreKeys in strict mode', () => {
		expect(
			isDuplicate(
				{ requestId: 101, msg: 'x' },
				{ requestId: 102, msg: 'x' },
				{
					...baseOpts,
					strict: true,
					ignoreKeys: ['time', 'pid', 'hostname', 'requestId'],
				},
			),
		).toBe(true);
	});

	it('treats different levels as non-duplicates when levelAware is true', () => {
		expect(
			isDuplicate(
				{ level: 30, msg: 'x' },
				{ level: 50, msg: 'x' },
				{ ...baseOpts, levelAware: true },
			),
		).toBe(false);
	});

	it('ignores level differences when levelAware is false (default)', () => {
		expect(
			isDuplicate(
				{ level: 30, msg: 'x' },
				{ level: 50, msg: 'x' },
				{ ...baseOpts, levelAware: false },
			),
		).toBe(true);
	});

	it('falls back to deep equality when msg is not a string on either side', () => {
		expect(
			isDuplicate({ msg: { code: 1 } }, { msg: { code: 1 } }, baseOpts),
		).toBe(true);
		expect(
			isDuplicate({ msg: { code: 1 } }, { msg: { code: 2 } }, baseOpts),
		).toBe(false);
	});

	it('uses a custom comparator when provided, overriding strict/simple logic', () => {
		const comparator = (
			a: Record<string, unknown>,
			b: Record<string, unknown>,
		) => a.id === b.id;
		expect(
			isDuplicate(
				{ id: 1, msg: 'a' },
				{ id: 1, msg: 'totally different' },
				{ ...baseOpts, comparator },
			),
		).toBe(true);
		expect(
			isDuplicate(
				{ id: 1, msg: 'a' },
				{ id: 2, msg: 'a' },
				{ ...baseOpts, comparator },
			),
		).toBe(false);
	});
});

import equal from 'fast-deep-equal';
import { DEFAULT_IGNORE_KEYS, DEFAULTS } from './constants';
import type { LogRecord, PinoQuietOptions, ResolvedOptions } from './types';

/**
 * Merges user options with defaults, validating the shapes we can validate
 * cheaply and throwing early on obviously-wrong configuration rather than
 * failing confusingly later inside the log pipeline.
 */
export function resolveOptions(opts: PinoQuietOptions = {}): ResolvedOptions {
	// These guards run before any default is applied so JS consumers that
	// bypass the TypeScript types get a clear, early failure instead of
	// confusing behavior deep inside the log pipeline (e.g. a `setTimeout`
	// firing immediately on a NaN interval).
	if (opts.maxRepeats !== undefined) {
		if (
			typeof opts.maxRepeats !== 'number' ||
			Number.isNaN(opts.maxRepeats)
		) {
			throw new RangeError(
				'pino-quiet: `maxRepeats` must be a number >= 1 (or Infinity)',
			);
		}
		if (opts.maxRepeats < 1) {
			throw new RangeError('pino-quiet: `maxRepeats` must be >= 1');
		}
	}
	if (opts.flushIntervalMs !== undefined) {
		if (
			typeof opts.flushIntervalMs !== 'number' ||
			Number.isNaN(opts.flushIntervalMs)
		) {
			throw new RangeError(
				'pino-quiet: `flushIntervalMs` must be a number >= 0',
			);
		}
		if (opts.flushIntervalMs < 0) {
			throw new RangeError('pino-quiet: `flushIntervalMs` must be >= 0');
		}
	}
	if (opts.minRepeatsToAnnotate !== undefined) {
		if (
			typeof opts.minRepeatsToAnnotate !== 'number' ||
			Number.isNaN(opts.minRepeatsToAnnotate)
		) {
			throw new RangeError(
				'pino-quiet: `minRepeatsToAnnotate` must be a number >= 1',
			);
		}
		if (opts.minRepeatsToAnnotate < 1) {
			throw new RangeError(
				'pino-quiet: `minRepeatsToAnnotate` must be >= 1',
			);
		}
	}
	if (
		opts.comparator !== undefined &&
		typeof opts.comparator !== 'function'
	) {
		throw new TypeError('pino-quiet: `comparator` must be a function');
	}
	if (
		opts.suffixFormat !== undefined &&
		typeof opts.suffixFormat !== 'function'
	) {
		throw new TypeError('pino-quiet: `suffixFormat` must be a function');
	}
	if (opts.onFlush !== undefined && typeof opts.onFlush !== 'function') {
		throw new TypeError('pino-quiet: `onFlush` must be a function');
	}
	if (opts.ignoreKeys !== undefined) {
		if (
			!Array.isArray(opts.ignoreKeys) ||
			opts.ignoreKeys.some((k) => typeof k !== 'string')
		) {
			throw new TypeError(
				'pino-quiet: `ignoreKeys` must be an array of strings',
			);
		}
	}
	for (const name of [
		'countField',
		'firstSeenField',
		'lastSeenField',
	] as const) {
		const value = opts[name];
		if (
			value !== undefined &&
			(typeof value !== 'string' ||
				value.length === 0 ||
				value === '__proto__')
		) {
			throw new TypeError(
				`pino-quiet: \`${name}\` must be a non-empty string (and cannot be \`__proto__\`)`,
			);
		}
	}

	const ignoreKeys = opts.ignoreKeys
		? Array.from(new Set([...DEFAULT_IGNORE_KEYS, ...opts.ignoreKeys]))
		: [...DEFAULT_IGNORE_KEYS];

	return {
		destination: opts.destination ?? DEFAULTS.destination,
		strict: opts.strict ?? DEFAULTS.strict,
		countField: opts.countField ?? DEFAULTS.countField,
		ignoreKeys,
		comparator: opts.comparator,
		levelAware: opts.levelAware ?? DEFAULTS.levelAware,
		caseInsensitive: opts.caseInsensitive ?? DEFAULTS.caseInsensitive,
		maxRepeats: opts.maxRepeats ?? DEFAULTS.maxRepeats,
		flushIntervalMs: opts.flushIntervalMs ?? DEFAULTS.flushIntervalMs,
		minRepeatsToAnnotate:
			opts.minRepeatsToAnnotate ?? DEFAULTS.minRepeatsToAnnotate,
		annotateMessage: opts.annotateMessage ?? DEFAULTS.annotateMessage,
		suffixFormat: opts.suffixFormat ?? ((count: number) => ` (x${count})`),
		includeTimestamps: opts.includeTimestamps ?? DEFAULTS.includeTimestamps,
		firstSeenField: opts.firstSeenField ?? DEFAULTS.firstSeenField,
		lastSeenField: opts.lastSeenField ?? DEFAULTS.lastSeenField,
		onFlush: opts.onFlush,
		pipeline: opts.pipeline ?? DEFAULTS.pipeline,
		mkdir: opts.mkdir ?? DEFAULTS.mkdir,
		append: opts.append ?? DEFAULTS.append,
		sync: opts.sync ?? DEFAULTS.sync,
	};
}

/** Strips volatile/ignored fields for strict-mode comparison. */
export function getComparable(obj: LogRecord, ignoreKeys: string[]): LogRecord {
	const rest: LogRecord = {};
	for (const key of Object.keys(obj)) {
		if (ignoreKeys.includes(key)) continue;
		if (key === '__proto__') {
			// `JSON.parse` can produce an own `__proto__` key; a plain bracket
			// assignment would mutate the prototype instead of copying it.
			Object.defineProperty(rest, key, {
				value: obj[key],
				writable: true,
				enumerable: true,
				configurable: true,
			});
			continue;
		}
		rest[key] = obj[key];
	}
	return rest;
}

/**
 * Determines whether `current` should be treated as a repeat of `previous`,
 * honoring `comparator`, `levelAware`, `strict`, `ignoreKeys` and
 * `caseInsensitive` in that precedence order.
 */
export function isDuplicate(
	previous: LogRecord,
	current: LogRecord,
	opts: Pick<
		ResolvedOptions,
		| 'comparator'
		| 'levelAware'
		| 'strict'
		| 'ignoreKeys'
		| 'caseInsensitive'
	>,
): boolean {
	if (opts.levelAware && previous.level !== current.level) {
		return false;
	}

	if (opts.comparator) {
		return opts.comparator(previous, current);
	}

	if (opts.strict) {
		return equal(
			getComparable(previous, opts.ignoreKeys),
			getComparable(current, opts.ignoreKeys),
		);
	}

	const prevMsg = previous.msg;
	const currMsg = current.msg;
	if (typeof prevMsg !== 'string' || typeof currMsg !== 'string') {
		return equal(prevMsg, currMsg);
	}
	return opts.caseInsensitive
		? prevMsg.toLowerCase() === currMsg.toLowerCase()
		: prevMsg === currMsg;
}

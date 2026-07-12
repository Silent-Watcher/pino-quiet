import equal from 'fast-deep-equal';
import { DEFAULT_IGNORE_KEYS, DEFAULTS } from './constants.ts';
import type { LogRecord, PinoQuietOptions, ResolvedOptions } from './types.ts';

/**
 * Merges user options with defaults, validating the shapes we can validate
 * cheaply and throwing early on obviously-wrong configuration rather than
 * failing confusingly later inside the log pipeline.
 */
export function resolveOptions(opts: PinoQuietOptions = {}): ResolvedOptions {
	if (opts.maxRepeats !== undefined && opts.maxRepeats < 1) {
		throw new RangeError('pino-quiet: `maxRepeats` must be >= 1');
	}
	if (opts.flushIntervalMs !== undefined && opts.flushIntervalMs < 0) {
		throw new RangeError('pino-quiet: `flushIntervalMs` must be >= 0');
	}
	if (
		opts.minRepeatsToAnnotate !== undefined &&
		opts.minRepeatsToAnnotate < 1
	) {
		throw new RangeError('pino-quiet: `minRepeatsToAnnotate` must be >= 1');
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
		if (!ignoreKeys.includes(key)) rest[key] = obj[key];
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

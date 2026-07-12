/** Fields always excluded from strict-mode comparisons (volatile per log line). */
export const DEFAULT_IGNORE_KEYS = ['time', 'pid', 'hostname'] as const;

export const DEFAULTS = {
	destination: 1 as string | number,
	strict: false,
	countField: 'repeats',
	levelAware: false,
	caseInsensitive: false,
	maxRepeats: Number.POSITIVE_INFINITY,
	flushIntervalMs: 5000,
	minRepeatsToAnnotate: 1,
	annotateMessage: true,
	includeTimestamps: false,
	firstSeenField: 'firstSeen',
	lastSeenField: 'lastSeen',
	pipeline: false,
	mkdir: false,
	append: true,
	sync: false,
} as const;

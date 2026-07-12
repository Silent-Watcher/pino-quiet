/** A parsed pino log line. Loosely typed because pino allows arbitrary user fields. */
// biome-ignore lint/suspicious/noExplicitAny: log objects are inherently dynamic
export type LogRecord = Record<string, any>;

/** Metadata passed to `onFlush` describing the batch that was just emitted. */
export interface FlushMeta {
	/** How many times the log repeated (1 means it was never duplicated). */
	repeats: number;
	/** Epoch ms when the first occurrence of this batch was buffered. */
	firstSeen: number;
	/** Epoch ms when the most recent occurrence of this batch was buffered. */
	lastSeen: number;
}

export interface PinoQuietOptions {
	/**
	 * Destination file descriptor or path. Defaults to `1` (stdout).
	 * Ignored when `pipeline` is `true`.
	 */
	destination?: string | number;

	/**
	 * If `true`, compares the entire log object (excluding volatile fields
	 * such as `time`/`pid`/`hostname`, see {@link ignoreKeys}).
	 * If `false` (default), only the `msg` string is compared.
	 */
	strict?: boolean;

	/** The field name to inject the repetition count into. Defaults to `'repeats'`. */
	countField?: string;

	/**
	 * Extra keys to exclude when comparing log objects in `strict` mode.
	 * Merged with the built-in defaults (`time`, `pid`, `hostname`) unless
	 * you pass an empty array intentionally.
	 */
	ignoreKeys?: string[];

	/**
	 * Custom equality function. When provided, it completely overrides the
	 * built-in `strict`/simple comparison logic. Receives the two raw,
	 * unmodified log objects.
	 */
	comparator?: (previous: LogRecord, current: LogRecord) => boolean;

	/**
	 * When `true`, logs with different `level` values are never considered
	 * duplicates of one another, even if their message/content matches.
	 * Defaults to `false` to preserve pre-1.0 behavior.
	 */
	levelAware?: boolean;

	/**
	 * When `true` (and `strict` is `false`), message comparison ignores case.
	 * Defaults to `false`.
	 */
	caseInsensitive?: boolean;

	/**
	 * Maximum number of repeats to buffer before force-flushing, even if
	 * duplicates keep arriving. Prevents unbounded counters / stale
	 * `firstSeen` timestamps in very hot loops. Defaults to `Infinity`
	 * (disabled).
	 */
	maxRepeats?: number;

	/**
	 * If a buffered (repeated) log sits idle for this many milliseconds
	 * without a new line arriving, it is automatically flushed. This keeps
	 * long-running, low-traffic processes from hiding a stale "final" count
	 * indefinitely. Set to `0` to disable. Defaults to `5000`.
	 */
	flushIntervalMs?: number;

	/**
	 * Only annotate (mutate `msg` / set `countField`) when the repeat count
	 * is at least this value. Defaults to `1`, matching pre-1.0 behavior
	 * (every repeated log is annotated).
	 */
	minRepeatsToAnnotate?: number;

	/**
	 * If `true` (default), the `msg` string is rewritten with a
	 * human-readable suffix (e.g. `"foo (x3)"`). If `false`, only
	 * `countField` is set and `msg` is left untouched — useful for
	 * structured-logging consumers that parse `msg` verbatim.
	 */
	annotateMessage?: boolean;

	/**
	 * Customize the suffix appended to `msg` when `annotateMessage` is
	 * `true`. Receives the total occurrence count. Defaults to
	 * `(count) => \` (x${count})\``.
	 */
	suffixFormat?: (count: number) => string;

	/**
	 * When `true`, adds first/last-seen epoch-ms timestamps to every
	 * flushed log (field names configurable via {@link firstSeenField} /
	 * {@link lastSeenField}). Defaults to `false`.
	 */
	includeTimestamps?: boolean;

	/** Field name for the first-seen timestamp. Defaults to `'firstSeen'`. */
	firstSeenField?: string;

	/** Field name for the last-seen timestamp. Defaults to `'lastSeen'`. */
	lastSeenField?: string;

	/**
	 * Called synchronously every time a (possibly collapsed) log is
	 * flushed, right before it is written/pushed downstream. Never throws:
	 * errors are caught and reported to `stderr` so a bad hook can't crash
	 * the logging pipeline.
	 */
	onFlush?: (log: LogRecord, meta: FlushMeta) => void;

	/**
	 * Enables pass-through pipeline mode: instead of writing to its own
	 * `destination`, pino-quiet becomes a Transform stream that yields
	 * deduplicated NDJSON downstream. Use this to place pino-quiet *before*
	 * `pino-pretty` (or any other transport) in a
	 * `pino.transport({ pipeline: [...] })` chain. Defaults to `false`.
	 */
	pipeline?: boolean;

	/** Passed through to `SonicBoom` (destination mode only). */
	mkdir?: boolean;
	/** Passed through to `SonicBoom` (destination mode only). */
	append?: boolean;
	/** Passed through to `SonicBoom` (destination mode only). */
	sync?: boolean;
}

export interface ResolvedOptions {
	destination: string | number;
	strict: boolean;
	countField: string;
	ignoreKeys: string[];
	comparator?: (previous: LogRecord, current: LogRecord) => boolean;
	levelAware: boolean;
	caseInsensitive: boolean;
	maxRepeats: number;
	flushIntervalMs: number;
	minRepeatsToAnnotate: number;
	annotateMessage: boolean;
	suffixFormat: (count: number) => string;
	includeTimestamps: boolean;
	firstSeenField: string;
	lastSeenField: string;
	onFlush?: (log: LogRecord, meta: FlushMeta) => void;
	pipeline: boolean;
	mkdir: boolean;
	append: boolean;
	sync: boolean;
}

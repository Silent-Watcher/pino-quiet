import pino from 'pino';

// Compose pino-quiet with pino-pretty: pino-quiet collapses repeats first,
// then hands the (fewer) resulting lines to pino-pretty for formatting.
//
// Requires `pipeline: true` so pino-quiet acts as a pass-through Transform
// instead of writing to its own destination.
const logger = pino({
	transport: {
		pipeline: [
			{
				target: 'pino-quiet',
				options: {
					pipeline: true,
					flushIntervalMs: 2000,
				},
			},
			{
				target: 'pino-pretty',
				options: {
					colorize: true,
				},
			},
		],
	},
});

logger.info('Database connection failed');
logger.info('Database connection failed');
logger.info('Database connection failed');
logger.error('Giving up on database. Exiting.');

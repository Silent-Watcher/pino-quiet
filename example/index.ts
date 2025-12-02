import pino from 'pino';

const logger = pino({
	transport: {
		target: 'pino-quiet',
		options: {
			// Options defined in our interface
			strict: false, // Simple message comparison
			countField: 'repeats',
		},
	},
	// Optional: Add a mixin to simulate real app data
	mixin: () => ({ appName: 'my-service' }),
});

console.log('--- Starting Log Simulation ---');

// 1. These three will be collapsed into one log line with "repeats": 3
logger.info('Database connection failed');
logger.info('Database connection failed');
logger.info('Database connection failed');

// 2. This different message will cause the previous group to flush
logger.error('Giving up on database. Exiting.');

// 3. Example of how "Strict: false" works (default)
// These have different `requestId`s, but because strict is FALSE,
// pino-quiet only checks the msg string ("Request processed").
// They will be collapsed.
logger.info({ requestId: 101 }, 'Request processed');
logger.info({ requestId: 102 }, 'Request processed');
logger.info({ requestId: 103 }, 'Request processed');

// 4. Force flush by logging something new
logger.info('Simulation complete.');

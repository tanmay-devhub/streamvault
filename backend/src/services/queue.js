const PgBoss = require('pg-boss');
const { logger } = require('../utils/logger');

const QUEUE_NAME = 'process-video';

let boss = null;

async function getQueue() {
  if (boss) return boss;
  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    retryLimit: 3,
    retryDelay: 60,      // seconds between retry attempts
    expireInHours: 24,
  });
  boss.on('error', (err) => logger.error(`pg-boss error: ${err.message}`));
  await boss.start();
  return boss;
}

async function stopQueue() {
  if (boss) {
    await boss.stop();
    boss = null;
  }
}

module.exports = { getQueue, stopQueue, QUEUE_NAME };

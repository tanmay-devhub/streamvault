require('dotenv').config();

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

const path = require('path');
const fs   = require('fs');
const PgBoss = require('pg-boss');
const { processVideo } = require('./workers/processVideo');
const { logger }       = require('./utils/logger');
const { migrate }      = require('./utils/migrate');

const QUEUE_NAME = 'process-video';
const TEMP_DIR   = path.join(__dirname, '../temp');

async function startWorker() {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

  // Ensure DB schema is up-to-date (also creates pg-boss tables)
  await migrate();

  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    retryLimit: 3,
    retryDelay: 60,
    expireInHours: 24,
  });

  boss.on('error', (err) => logger.error(`Queue error: ${err.message}`));
  await boss.start();

  logger.info('🎬 Video processing worker started');
  logger.info(`📦 S3:  ${process.env.AWS_S3_BUCKET || '❌ NOT SET'}`);
  logger.info(`🗄️  DB:  ${process.env.DATABASE_URL ? 'NeonDB ✅' : '❌ NOT SET'}`);

  // teamSize=1, teamConcurrency=1 → process one video at a time to keep memory bounded
  await boss.work(QUEUE_NAME, { teamSize: 1, teamConcurrency: 1 }, async (job) => {
    logger.info(`Job ${job.id}: processing video ${job.data.videoId}`);
    await processVideo(job.data);
    logger.info(`Job ${job.id}: done`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down worker gracefully`);
    await boss.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

// Only auto-start when run directly (not when required by server.js)
if (require.main === module) {
  startWorker().catch((err) => {
    logger.error(`Worker startup failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { startWorker };

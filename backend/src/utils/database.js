const { Pool } = require('pg');
const { logger } = require('./logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for NeonDB
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => logger.error(`PG pool error: ${err.message}`));

async function query(text, params = []) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    logger.error(`Query failed: ${err.message}\nSQL: ${text.slice(0, 200)}`);
    throw err;
  }
}

module.exports = { pool, query };

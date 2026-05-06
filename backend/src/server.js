require('dotenv').config();

// Prevent a single unhandled async rejection from crashing the server
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const path      = require('path');
const fs        = require('fs');
const { logger }   = require('./utils/logger');
const { migrate }  = require('./utils/migrate');
const { db }       = require('./utils/db');

const videoRoutes   = require('./routes/videos');
const adminRoutes   = require('./routes/admin');
const profileRoutes = require('./routes/profiles');
const hlsRoutes     = require('./routes/hls');
const shareRoutes   = require('./routes/share');
const historyRoutes = require('./routes/history');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: Origin "${origin}" not allowed`));
  },
  methods: ['GET', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

// ── Ensure temp dirs ─────────────────────────────────────────
['uploads', 'temp'].forEach((dir) => {
  const p = path.join(__dirname, '..', dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ── Routes ───────────────────────────────────────────────────
app.use('/api/videos',  videoRoutes);
app.use('/api/admin',   adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/hls',     hlsRoutes);
app.use('/api/share',   shareRoutes);   // public — no auth middleware
app.use('/api/history', historyRoutes);

app.get('/health', (req, res) => res.json({
  status: 'ok', timestamp: new Date().toISOString(), uptime: Math.round(process.uptime()),
  storage: process.env.AWS_S3_BUCKET ? 'S3 connected' : 'S3 NOT configured',
  auth:    process.env.CLERK_SECRET_KEY ? 'Clerk connected' : 'Clerk NOT configured',
  db:      process.env.DATABASE_URL ? 'NeonDB connected' : 'DATABASE_URL NOT set',
}));

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => {
  logger.error(`Unhandled: ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// ── Start ─────────────────────────────────────────────────────
async function start() {
  // Run DB migration first, then start listening
  await migrate();

  // Note: videos in 'processing' are now owned by the background worker (src/worker.js).
  // The worker uses pg-boss which auto-retries crashed jobs — don't mark them failed here.

  app.listen(PORT, () => {
    logger.info(`🚀 API: http://localhost:${PORT}`);
    logger.info(`🔐 Auth:  Clerk ${process.env.CLERK_SECRET_KEY ? '✅' : '❌ NOT SET'}`);
    logger.info(`📦 S3:    ${process.env.AWS_S3_BUCKET || '❌ NOT SET'}`);
    logger.info(`🗄️  DB:    ${process.env.DATABASE_URL ? 'NeonDB ✅' : '❌ DATABASE_URL NOT SET'}`);

    // On Render free tier there is no separate worker dyno, so run it in-process.
    // Set RUN_WORKER=true in the environment to enable this.
    if (process.env.RUN_WORKER === 'true') {
      const { startWorker } = require('./worker');
      startWorker().catch((err) => logger.error(`Inline worker failed to start: ${err.message}`));
    }
  });
}

start().catch((err) => {
  logger.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});

module.exports = app;

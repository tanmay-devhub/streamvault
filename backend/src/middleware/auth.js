const { createClerkClient, verifyToken } = require('@clerk/backend');
const { query }  = require('../utils/database');
const { logger } = require('../utils/logger');

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function requireAuth(req, res, next) {
  if (!process.env.CLERK_SECRET_KEY) {
    return res.status(500).json({ error: 'Server misconfiguration: Clerk secret key missing.' });
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = await verifyToken(header.slice(7), { secretKey: process.env.CLERK_SECRET_KEY });
    const user    = await clerk.users.getUser(payload.sub);

    if (user.publicMetadata?.banned === true) {
      return res.status(403).json({ error: 'BANNED', message: 'Your account has been suspended.' });
    }

    // Check active suspension in DB (supports grace period / reason / until)
    const { rows } = await query(
      `SELECT reason, suspended_until FROM suspensions
       WHERE user_id = $1
         AND (suspended_until IS NULL OR suspended_until > NOW())`,
      [payload.sub]
    );
    if (rows.length > 0) {
      const s = rows[0];
      return res.status(403).json({
        error: 'SUSPENDED',
        message: s.reason || 'Your account has been suspended.',
        until:   s.suspended_until || null,
      });
    }

    req.auth = { userId: payload.sub, sessionId: payload.sid, clerkUser: user };
    next();
  } catch (err) {
    logger.warn(`Auth failed: ${err.message}`);
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

// Optional auth — never blocks the request.
// Sets req.auth when a valid token is present, leaves it null otherwise.
// Used for HLS routes: public videos stream without a token; private
// videos still enforce ownership inside the controller.
async function optionalAuth(req, res, next) {
  req.auth = null;
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    const payload = await verifyToken(header.slice(7), { secretKey: process.env.CLERK_SECRET_KEY });
    const user    = await clerk.users.getUser(payload.sub);
    req.auth = { userId: payload.sub, sessionId: payload.sid, clerkUser: user };
  } catch {}
  next();
}

async function requireAdmin(req, res, next) {
  if (!req.auth?.clerkUser) return res.status(401).json({ error: 'Authentication required.' });
  if (req.auth.clerkUser.publicMetadata?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

module.exports = { requireAuth, optionalAuth, requireAdmin, clerk };

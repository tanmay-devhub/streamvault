const { db }         = require('../utils/db');
const { profileDb }  = require('../utils/profileDb');
const { query }      = require('../utils/database');
const { auditLog }   = require('../utils/audit');
const { logger }     = require('../utils/logger');
const s3Service      = require('../services/s3Service');
const { clerk }      = require('../middleware/auth');
const { enrichVideoUrls } = require('./videoController');

// ─────────────────────────────────────────────────────────────
// GET /api/admin/stats
// ─────────────────────────────────────────────────────────────
async function getStats(req, res) {
  const all = await db.findAll({ adminMode: true });
  const stats = {
    total:      all.length,
    ready:      all.filter((v) => v.status === 'ready').length,
    processing: all.filter((v) => v.status === 'processing').length,
    failed:     all.filter((v) => v.status === 'failed').length,
    recentUploads: all.slice(0, 5).map((v) => ({
      id: v.id, title: v.title, status: v.status, createdAt: v.createdAt,
    })),
  };
  res.json(stats);
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/videos
// ─────────────────────────────────────────────────────────────
async function listAllVideos(req, res) {
  const { search = '', sortBy = 'createdAt', order = 'desc', page = 1, limit = 20 } = req.query;
  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const all    = await db.findAll({ search, sortBy, order, adminMode: true });
  const total  = all.length;
  const sliced = all.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  // Batch-fetch uploader profiles (one query per unique uploaderId)
  const uploaderIds = [...new Set(sliced.map((v) => v.uploaderId).filter(Boolean))];
  const profileResults = await Promise.all(uploaderIds.map((id) => profileDb.findByUserId(id)));
  const profileMap = Object.fromEntries(uploaderIds.map((id, i) => [id, profileResults[i]]));

  const videos = await Promise.all(sliced.map(async (v) => {
    const enriched = await enrichVideoUrls(v, req);
    const prof = v.uploaderId ? profileMap[v.uploaderId] : null;
    enriched.uploaderProfile = prof
      ? { channelName: prof.channelName, avatarUrl: prof.avatarUrl }
      : null;
    return enriched;
  }));

  res.json({ videos, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/videos/:id
// ─────────────────────────────────────────────────────────────
async function adminDeleteVideo(req, res) {
  const video = await db.findById(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found.' });
  try {
    if (video.s3Prefix) await s3Service.deletePrefix(video.s3Prefix + '/');
    await db.delete(req.params.id);
    await auditLog(req.auth.userId, 'delete_video', 'video', req.params.id, { title: video.title });
    res.json({ message: 'Video deleted.' });
  } catch (err) {
    logger.error(`Admin delete failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/videos/failed/all
// ─────────────────────────────────────────────────────────────
async function deleteAllFailed(req, res) {
  const failed = await db.findByStatus('failed');
  let deleted = 0;
  for (const v of failed) {
    try {
      if (v.s3Prefix) await s3Service.deletePrefix(v.s3Prefix + '/');
      await db.delete(v.id);
      deleted++;
    } catch (e) {
      logger.warn(`Could not delete ${v.id}: ${e.message}`);
    }
  }
  await auditLog(req.auth.userId, 'delete_all_failed', 'video', 'bulk', { count: deleted });
  res.json({ message: `Deleted ${deleted} failed video(s).`, deleted });
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/users
// ─────────────────────────────────────────────────────────────
async function listUsers(req, res) {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const response = await clerk.users.getUserList({
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      orderBy: '-created_at',
    });

    // Fetch all active suspensions in one query
    const { rows: suspRows } = await query('SELECT * FROM suspensions');
    const suspMap = Object.fromEntries(suspRows.map((r) => [r.user_id, r]));

    const users = response.data.map((u) => {
      const susp = suspMap[u.id];
      const activeSusp = susp && (!susp.suspended_until || new Date(susp.suspended_until) > new Date())
        ? { reason: susp.reason, until: susp.suspended_until }
        : null;
      return {
        id:          u.id,
        email:       u.emailAddresses[0]?.emailAddress || '—',
        firstName:   u.firstName,
        lastName:    u.lastName,
        imageUrl:    u.imageUrl,
        role:        u.publicMetadata?.role || 'user',
        createdAt:   u.createdAt,
        lastSignIn:  u.lastSignInAt,
        suspension:  activeSusp,
      };
    });
    res.json({ users, total: response.totalCount });
  } catch (err) {
    logger.error(`List users error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/users/:id/role
// ─────────────────────────────────────────────────────────────
async function setUserRole(req, res) {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Role must be "admin" or "user".' });
  }
  try {
    await clerk.users.updateUserMetadata(req.params.id, { publicMetadata: { role } });
    await auditLog(req.auth.userId, 'set_role', 'user', req.params.id, { role });
    res.json({ message: `Role updated to "${role}".` });
  } catch (err) {
    logger.error(`Set role error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/admin/users/:id/suspend
// Body: { reason?, durationDays? }  — durationDays omitted = permanent
// ─────────────────────────────────────────────────────────────
async function suspendUser(req, res) {
  const { reason = '', durationDays } = req.body;
  const suspendedUntil = durationDays
    ? new Date(Date.now() + durationDays * 86_400_000).toISOString()
    : null;

  await query(
    `INSERT INTO suspensions (user_id, suspended_by, reason, suspended_until)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id) DO UPDATE
       SET suspended_by = EXCLUDED.suspended_by,
           reason       = EXCLUDED.reason,
           suspended_until = EXCLUDED.suspended_until,
           created_at   = NOW()`,
    [req.params.id, req.auth.userId, reason, suspendedUntil]
  );
  await auditLog(req.auth.userId, 'suspend_user', 'user', req.params.id, { reason, suspendedUntil });
  res.json({ message: 'User suspended.', until: suspendedUntil });
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/users/:id/suspend  — lift suspension
// ─────────────────────────────────────────────────────────────
async function liftSuspension(req, res) {
  await query('DELETE FROM suspensions WHERE user_id = $1', [req.params.id]);
  await auditLog(req.auth.userId, 'lift_suspension', 'user', req.params.id, {});
  res.json({ message: 'Suspension lifted.' });
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/audit
// ─────────────────────────────────────────────────────────────
async function getAuditLog(req, res) {
  const { page = 1, limit = 50 } = req.query;
  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const offset   = (pageNum - 1) * limitNum;

  const { rows } = await query(
    `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limitNum, offset]
  );
  const countRes = await query('SELECT COUNT(*) FROM audit_log');
  const total    = parseInt(countRes.rows[0].count, 10);

  res.json({
    entries: rows.map((r) => ({
      id:         r.id,
      adminId:    r.admin_id,
      action:     r.action,
      targetType: r.target_type,
      targetId:   r.target_id,
      details:    r.details,
      createdAt:  r.created_at,
    })),
    pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
  });
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/profiles
// ─────────────────────────────────────────────────────────────
async function listProfiles(req, res) {
  const { search = '', page = 1, limit = 20 } = req.query;
  const result = await profileDb.findAll({ search, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  res.json(result);
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/profiles/:userId
// ─────────────────────────────────────────────────────────────
async function adminUpdateProfile(req, res) {
  const { channelName, bio } = req.body;
  const existing = await profileDb.findByUserId(req.params.userId);
  if (!existing) return res.status(404).json({ error: 'Profile not found.' });

  const fields = {};
  if (channelName !== undefined) fields.channelName = channelName;
  if (bio         !== undefined) fields.bio         = bio;

  try {
    const updated = await profileDb.update(req.params.userId, fields);
    await auditLog(req.auth.userId, 'edit_profile', 'profile', req.params.userId, fields);
    res.json(updated);
  } catch (err) {
    if (profileDb.isUniqueViolation(err)) {
      return res.status(409).json({ error: 'That channel name is already taken.' });
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/profiles/:userId
// ─────────────────────────────────────────────────────────────
async function adminDeleteProfile(req, res) {
  const existing = await profileDb.findByUserId(req.params.userId);
  if (!existing) return res.status(404).json({ error: 'Profile not found.' });
  await profileDb.delete(req.params.userId);
  await auditLog(req.auth.userId, 'delete_profile', 'profile', req.params.userId, { channelName: existing.channelName });
  res.json({ message: 'Profile deleted.' });
}

module.exports = {
  getStats, listAllVideos, adminDeleteVideo, deleteAllFailed,
  listUsers, setUserRole,
  suspendUser, liftSuspension,
  getAuditLog,
  listProfiles, adminUpdateProfile, adminDeleteProfile,
};

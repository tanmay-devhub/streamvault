const { query }  = require('../utils/database');
const s3Service   = require('../services/s3Service');

async function saveProgress(req, res) {
  const { id } = req.params;
  const { position, duration } = req.body;
  if (typeof position !== 'number' || typeof duration !== 'number' || duration <= 0) {
    return res.status(400).json({ error: 'position and duration (numbers) required.' });
  }
  try {
    await query(
      `INSERT INTO watch_progress (user_id, video_id, position, duration, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, video_id)
       DO UPDATE SET position = $3, duration = $4, updated_at = NOW()`,
      [req.auth.userId, id, Math.floor(position), Math.floor(duration)]
    );
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
}

async function getProgress(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await query(
      'SELECT position, duration FROM watch_progress WHERE user_id = $1 AND video_id = $2',
      [req.auth.userId, id]
    );
    res.json(rows[0] || { position: 0, duration: 0 });
  } catch {
    res.json({ position: 0, duration: 0 });
  }
}

async function getHistory(req, res) {
  const userId = req.auth.userId;
  try {
    const { rows } = await query(
      `SELECT wp.video_id, wp.position, wp.duration, wp.updated_at,
              v.title, v.thumbnail_key, v.status, v.privacy, v.uploader_id
       FROM watch_progress wp
       JOIN videos v ON v.id = wp.video_id
       WHERE wp.user_id = $1
         AND v.status = 'ready'
         AND wp.position > 10
         AND wp.position < (wp.duration * 0.97)
         AND (v.privacy = 'public' OR v.uploader_id = $1)
       ORDER BY wp.updated_at DESC
       LIMIT 12`,
      [userId]
    );
    const enriched = await Promise.all(rows.map(async (r) => ({
      id:          r.video_id,
      title:       r.title,
      thumbnailUrl: r.thumbnail_key
        ? await s3Service.getPresignedUrl(r.thumbnail_key, 7 * 24 * 3600)
        : null,
      position:  r.position,
      duration:  r.duration,
      updatedAt: r.updated_at,
    })));
    res.json(enriched);
  } catch {
    res.json([]);
  }
}

module.exports = { saveProgress, getProgress, getHistory };

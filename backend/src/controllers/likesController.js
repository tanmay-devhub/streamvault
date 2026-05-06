const { db }     = require('../utils/db');
const { query }  = require('../utils/database');
const { logger } = require('../utils/logger');

// POST /api/videos/:id/like  — toggle like, returns { liked, count }
async function toggleLike(req, res) {
  const videoId = req.params.id;
  const userId  = req.auth.userId;

  const video = await db.findById(videoId);
  if (!video) return res.status(404).json({ error: 'Video not found.' });

  // Check current like status
  const { rows } = await query(
    'SELECT 1 FROM video_likes WHERE video_id = $1 AND user_id = $2',
    [videoId, userId]
  );
  const alreadyLiked = rows.length > 0;

  if (alreadyLiked) {
    await query('DELETE FROM video_likes WHERE video_id = $1 AND user_id = $2', [videoId, userId]);
    await query('UPDATE videos SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1', [videoId]);
  } else {
    await query('INSERT INTO video_likes (video_id, user_id) VALUES ($1, $2)', [videoId, userId]);
    await query('UPDATE videos SET likes_count = likes_count + 1 WHERE id = $1', [videoId]);
  }

  const updated = await db.findById(videoId);
  res.json({ liked: !alreadyLiked, count: updated.likesCount });
}

// GET /api/videos/:id/like  — current user's like status
async function getLikeStatus(req, res) {
  const { rows } = await query(
    'SELECT 1 FROM video_likes WHERE video_id = $1 AND user_id = $2',
    [req.params.id, req.auth.userId]
  );
  const video = await db.findById(req.params.id);
  res.json({ liked: rows.length > 0, count: video?.likesCount || 0 });
}

module.exports = { toggleLike, getLikeStatus };

const { query } = require('../utils/database');
const { db }    = require('../utils/db');

async function getAnalytics(req, res) {
  const { id } = req.params;
  try {
    const video = await db.findById(id);
    if (!video) return res.status(404).json({ error: 'Video not found.' });

    const isOwner = video.uploaderId === req.auth.userId;
    const isAdmin = req.auth.clerkUser?.publicMetadata?.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Access denied.' });

    const [progressRes, viewsRes, heatmapRes] = await Promise.all([
      query(
        `SELECT
           COALESCE(AVG(CASE WHEN duration > 0 THEN position::float / duration ELSE 0 END), 0) AS avg_completion,
           COUNT(*)::int AS unique_viewers
         FROM watch_progress WHERE video_id = $1`,
        [id]
      ),
      query(
        `SELECT DATE_TRUNC('day', viewed_at)::date AS day, COUNT(*)::int AS views
         FROM view_log
         WHERE video_id = $1 AND viewed_at > NOW() - INTERVAL '14 days'
         GROUP BY day ORDER BY day ASC`,
        [id]
      ),
      query(
        'SELECT bucket, count FROM heatmap_events WHERE video_id = $1 ORDER BY bucket',
        [id]
      ),
    ]);

    res.json({
      title:         video.title,
      duration:      video.duration || 0,
      totalViews:    video.viewsCount,
      totalLikes:    video.likesCount,
      likeRatio:     video.viewsCount > 0 ? video.likesCount / video.viewsCount : 0,
      avgCompletion: parseFloat(progressRes.rows[0]?.avg_completion || 0),
      uniqueViewers: parseInt(progressRes.rows[0]?.unique_viewers || 0),
      viewsPerDay:   viewsRes.rows.map((r) => ({ day: r.day, views: r.views })),
      heatmap:       heatmapRes.rows.map((r) => ({ bucket: parseInt(r.bucket), count: parseInt(r.count) })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getAnalytics };

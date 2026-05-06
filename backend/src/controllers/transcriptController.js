const { query } = require('../utils/database');
const { db }    = require('../utils/db');

async function getTranscript(req, res) {
  const { id } = req.params;

  // Verify the video exists and is accessible
  const video = await db.findById(id);
  if (!video) return res.status(404).json({ error: 'Video not found.' });

  const isOwner = video.uploaderId === req.auth.userId;
  const isAdmin = req.auth.clerkUser?.publicMetadata?.role === 'admin';
  if (video.privacy === 'private' && !isOwner && !isAdmin) {
    return res.status(403).json({ error: 'This video is private.' });
  }

  const { rows } = await query(
    'SELECT segments, language FROM transcripts WHERE video_id = $1',
    [id]
  );

  if (!rows.length) return res.status(404).json({ error: 'No transcript available yet.' });
  res.json({ segments: rows[0].segments, language: rows[0].language });
}

module.exports = { getTranscript };

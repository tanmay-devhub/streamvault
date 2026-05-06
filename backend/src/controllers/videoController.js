const path = require('path');
const fs   = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 }  = require('uuid');
const { db }           = require('../utils/db');
const { query }        = require('../utils/database');
const { logger }       = require('../utils/logger');
const s3Service        = require('../services/s3Service');
const { getQueue, QUEUE_NAME } = require('../services/queue');

// Build the URLs callers see — thumbnail is presigned S3, video goes through HLS proxy.
async function enrichVideoUrls(video, req) {
  if (!video) return null;
  const out = { ...video };

  if (video.thumbnailKey) {
    // 7-day presigned URL — fast (local HMAC, no HTTP call)
    out.thumbnailUrl = await s3Service.getPresignedUrl(video.thumbnailKey, 7 * 24 * 3600);
  }

  if (video.masterKey) {
    // HLS requests are proxied through our API so auth is checked on every playlist fetch
    const base = req ? `${req.protocol}://${req.get('host')}` : '';
    out.masterUrl = `${base}/api/hls/${video.id}/master.m3u8`;
  }

  // Build rendition proxy URLs for the quality selector in the player
  if (video.renditionKeys && Object.keys(video.renditionKeys).length) {
    const base = req ? `${req.protocol}://${req.get('host')}` : '';
    out.renditionUrls = Object.fromEntries(
      Object.keys(video.renditionKeys).map((q) => [
        q,
        `${base}/api/hls/${video.id}/${q}/playlist.m3u8`,
      ])
    );
  }

  return out;
}

const ALLOWED_VIDEO_CONTENT_TYPES = new Set([
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
  'video/webm', 'video/mpeg', 'video/x-flv', 'video/3gpp',
]);
const ALLOWED_VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.mpeg', '.mpg', '.flv', '.3gp']);

// ─────────────────────────────────────────────────────────────
// POST /api/videos/prepare  (step 1 of direct-to-S3 upload)
// Returns a presigned S3 PUT URL so the browser can upload directly,
// bypassing the backend entirely and avoiding Render's 30-second timeout.
// ─────────────────────────────────────────────────────────────
async function prepareUpload(req, res) {
  const { filename = 'video.mp4', contentType = 'video/mp4', title, description, privacy } = req.body;
  const ext = path.extname(filename).toLowerCase() || '.mp4';

  if (!ALLOWED_VIDEO_CONTENT_TYPES.has(contentType) && !ALLOWED_VIDEO_EXTS.has(ext)) {
    return res.status(400).json({ error: 'Unsupported file type.' });
  }

  const videoId    = uuidv4();
  const s3Key      = `originals/${videoId}${ext}`;
  const privacyVal = ['public', 'unlisted', 'private'].includes(privacy) ? privacy : 'public';

  try {
    await db.insert({
      id:           videoId,
      uploaderId:   req.auth.userId,
      title:        title || path.parse(filename).name,
      description:  description || '',
      status:       'pending_upload',
      originalName: filename,
      privacy:      privacyVal,
    });

    const uploadUrl = await s3Service.getPresignedUploadUrl(s3Key, contentType, 3600);
    res.json({ videoId, uploadUrl, s3Key });
  } catch (err) {
    logger.error(`prepareUpload error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/videos/:id/finalize  (step 2 of direct-to-S3 upload)
// Called after the browser finishes the S3 PUT. Queues the processing job.
// ─────────────────────────────────────────────────────────────
async function finalizeUpload(req, res) {
  const { s3Key } = req.body;
  if (!s3Key) return res.status(400).json({ error: 's3Key is required.' });

  const video = await db.findById(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found.' });
  if (video.uploaderId !== req.auth.userId) return res.status(403).json({ error: 'Access denied.' });

  // Idempotent: if already queued, just return success
  if (video.status === 'processing') {
    return res.json({ videoId: req.params.id, status: 'processing' });
  }
  if (video.status !== 'pending_upload') {
    return res.status(409).json({ error: `Cannot finalize a video with status: ${video.status}` });
  }

  try {
    // Confirm the file actually landed in S3 before queuing.
    // If the browser's direct S3 PUT failed (e.g. CORS), the worker would
    // immediately fail with "key does not exist" — catch it here instead.
    const exists = await s3Service.checkObjectExists(s3Key);
    if (!exists) {
      return res.status(400).json({
        error: 'Upload did not reach S3. Check your S3 CORS policy allows PUT from this origin, then try again.',
      });
    }

    await db.update(req.params.id, { status: 'processing' });
    const queue = await getQueue();
    await queue.send(QUEUE_NAME, {
      videoId:       req.params.id,
      s3OriginalKey: s3Key,
      originalExt:   path.extname(s3Key),
    });
    res.json({ message: 'Processing started.', videoId: req.params.id, status: 'processing' });
  } catch (err) {
    logger.error(`finalizeUpload error for ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/videos/upload
// ─────────────────────────────────────────────────────────────
async function uploadVideo(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No video file provided.' });

  const videoId      = uuidv4();
  const inputPath    = req.file.path;
  const originalExt  = path.extname(req.file.originalname).toLowerCase() || '.mp4';
  const privacy      = ['public', 'unlisted', 'private'].includes(req.body.privacy)
    ? req.body.privacy
    : 'public';

  try {
    // Stream the raw upload to S3 so the background worker can fetch it.
    // Using createReadStream keeps the web process memory flat.
    const s3OriginalKey = `originals/${videoId}${originalExt}`;
    await s3Service.uploadFile(inputPath, s3OriginalKey, req.file.mimetype || 'video/mp4');

    await db.insert({
      id:           videoId,
      uploaderId:   req.auth.userId,
      title:        req.body.title || path.parse(req.file.originalname).name,
      description:  req.body.description || '',
      status:       'processing',
      originalName: req.file.originalname,
      privacy,
    });

    // Hand off to the background worker via pg-boss queue
    const queue = await getQueue();
    await queue.send(QUEUE_NAME, { videoId, s3OriginalKey, originalExt });

    res.status(202).json({ message: 'Upload accepted. Processing started.', videoId, status: 'processing' });
  } catch (err) {
    logger.error(`Upload handler error: ${err.message}`);
    res.status(500).json({ error: err.message });
  } finally {
    // Delete local temp file — S3 is now the source of truth
    try { fs.unlinkSync(inputPath); } catch (_) {}
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/videos
// ─────────────────────────────────────────────────────────────
async function listVideos(req, res) {
  const { search = '', sortBy = 'createdAt', order = 'desc', page = 1, limit = 12, uploaderId = '' } = req.query;
  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

  const all = await db.findAll({ search, sortBy, order, uploaderId, requestingUserId: req.auth.userId });
  const total  = all.length;
  const sliced = all.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  // Enrich with presigned thumbnail URLs (fast local HMAC — no round-trips)
  const videos = await Promise.all(sliced.map((v) => enrichVideoUrls(v, req)));

  res.json({ videos, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
}

// ─────────────────────────────────────────────────────────────
// GET /api/videos/:id
// ─────────────────────────────────────────────────────────────
async function getVideo(req, res) {
  const video = await db.findById(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found.' });

  const isOwner = video.uploaderId === req.auth.userId;
  const isAdmin = req.auth.clerkUser?.publicMetadata?.role === 'admin';

  if (video.privacy === 'private' && !isOwner && !isAdmin) {
    return res.status(403).json({ error: 'This video is private.' });
  }

  db.incrementViews(req.params.id).catch(() => {});
  query('INSERT INTO view_log (video_id, user_id) VALUES ($1, $2)', [req.params.id, req.auth.userId]).catch(() => {});

  res.json(await enrichVideoUrls(video, req));
}

// ─────────────────────────────────────────────────────────────
// GET /api/videos/:id/status  (scoped to owner or admin)
// ─────────────────────────────────────────────────────────────
async function getVideoStatus(req, res) {
  const video = await db.findById(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found.' });

  const isOwner = video.uploaderId === req.auth.userId;
  const isAdmin = req.auth.clerkUser?.publicMetadata?.role === 'admin';
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Access denied.' });

  res.json({ id: video.id, status: video.status, errorMessage: video.errorMessage || null });
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/videos/:id
// ─────────────────────────────────────────────────────────────
async function updateVideo(req, res) {
  const video = await db.findById(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found.' });

  const isOwner = video.uploaderId === req.auth.userId;
  const isAdmin = req.auth.clerkUser?.publicMetadata?.role === 'admin';
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Access denied.' });

  const { title, description, privacy } = req.body;
  const fields = {};
  if (title       !== undefined) fields.title       = title;
  if (description !== undefined) fields.description = description;
  if (privacy     !== undefined && ['public', 'unlisted', 'private'].includes(privacy)) {
    fields.privacy = privacy;
  }

  const updated = await db.update(req.params.id, fields);
  res.json(await enrichVideoUrls(updated, req));
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/videos/:id  (admin only via route middleware)
// ─────────────────────────────────────────────────────────────
async function deleteVideo(req, res) {
  const video = await db.findById(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found.' });

  const isOwner = video.uploaderId === req.auth.userId;
  const isAdmin = req.auth.clerkUser?.publicMetadata?.role === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'You can only delete your own videos.' });
  }

  try {
    // Delete HLS files, thumbnail, etc. under videos/{videoId}/
    if (video.s3Prefix) await s3Service.deletePrefix(video.s3Prefix + '/');
    // Delete the raw original if the worker hasn't cleaned it up yet
    const originalExt = path.extname(video.originalName || '').toLowerCase() || '.mp4';
    await s3Service.deleteObject(`originals/${video.id}${originalExt}`).catch(() => {});
    await db.delete(req.params.id);
    res.json({ message: 'Video deleted successfully.' });
  } catch (err) {
    logger.error(`Delete failed for ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/videos/:id/thumbnail
// ─────────────────────────────────────────────────────────────
async function uploadThumbnail(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No image file provided.' });

  const video = await db.findById(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found.' });

  const isOwner = video.uploaderId === req.auth.userId;
  const isAdmin = req.auth.clerkUser?.publicMetadata?.role === 'admin';
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Access denied.' });

  const resizedPath = req.file.path + '_thumb.jpg';
  try {
    await sharp(req.file.path)
      .resize(1280, 720, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 85 })
      .toFile(resizedPath);

    const thumbKey = video.s3Prefix
      ? `${video.s3Prefix}/thumbnail.jpg`
      : `videos/${video.id}/thumbnail.jpg`;

    await s3Service.uploadFile(resizedPath, thumbKey, 'image/jpeg');
    const updated = await db.update(req.params.id, { thumbnailKey: thumbKey });
    res.json(await enrichVideoUrls(updated, req));
  } finally {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    try { fs.unlinkSync(resizedPath); }  catch (_) {}
  }
}

module.exports = { prepareUpload, finalizeUpload, uploadVideo, listVideos, getVideo, getVideoStatus, updateVideo, deleteVideo, uploadThumbnail, enrichVideoUrls };

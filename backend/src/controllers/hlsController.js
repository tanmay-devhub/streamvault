const { db }       = require('../utils/db');
const s3Service    = require('../services/s3Service');
const { logger }   = require('../utils/logger');

const BUCKET = process.env.AWS_S3_BUCKET;

// Old videos have absolute S3 URLs baked into their master.m3u8.
// Rewrite any such URLs to go through our proxy so auth is enforced
// and the private bucket isn't exposed directly.
function rewritePlaylist(text, videoId) {
  if (!BUCKET || !text.includes('amazonaws.com')) return text;
  // Matches: https://bucket.s3.amazonaws.com/videos/id/…
  //      and https://bucket.s3.region.amazonaws.com/videos/id/…
  const re = new RegExp(
    `https://${BUCKET}\\.s3(?:\\.[\\w-]+)?\\.amazonaws\\.com/videos/${videoId}/([^\\s]+)`,
    'g'
  );
  return text.replace(re, `/api/hls/${videoId}/$1`);
}

/**
 * GET /api/hls/:videoId/*
 *
 * Proxies HLS content from private S3:
 *  - .m3u8 playlists → fetched internally via presigned URL, streamed to client
 *    (playlists contain relative paths, so the player re-requests subsequent
 *     files relative to /api/hls/:videoId/…, keeping auth in the loop)
 *  - .ts  segments   → 302 redirect to a short-lived presigned URL
 *    (saves server bandwidth; the segment URL expires in 5 minutes)
 */
async function serveHls(req, res) {
  try {
    const { videoId } = req.params;
    const filePath    = req.params[0]; // e.g. "master.m3u8" or "360p/segment_00001.ts"

    const video = await db.findById(videoId);
    if (!video) return res.status(404).end();

    // Private videos require an authenticated user who is the owner or admin.
    // Public and unlisted videos stream without a token so HLS.js works natively.
    if (video.privacy === 'private') {
      if (!req.auth) return res.status(403).end();
      const isOwner = video.uploaderId === req.auth.userId;
      const isAdmin = req.auth.clerkUser?.publicMetadata?.role === 'admin';
      if (!isOwner && !isAdmin) return res.status(403).end();
    }

    const s3Key = `${video.s3Prefix}/${filePath}`;

    if (filePath.endsWith('.m3u8')) {
      // Fetch playlist, rewrite any legacy absolute S3 URLs to proxy paths, stream out.
      const signedUrl = await s3Service.getPresignedUrl(s3Key, 60);
      const upstream  = await fetch(signedUrl);
      if (!upstream.ok) return res.status(upstream.status).end();

      const text    = await upstream.text();
      const rewritten = rewritePlaylist(text, videoId);

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store');
      res.setHeader('Content-Length', Buffer.byteLength(rewritten));
      res.end(rewritten);
    } else {
      // Segments: redirect to a 5-minute presigned URL
      const signedUrl = await s3Service.getPresignedUrl(s3Key, 300);
      res.redirect(302, signedUrl);
    }
  } catch (err) {
    logger.error(`HLS proxy error: ${err.message}`);
    res.status(500).end();
  }
}

module.exports = { serveHls };

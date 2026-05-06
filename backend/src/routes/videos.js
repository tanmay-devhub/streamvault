const express    = require('express');
const multer     = require('multer');
const path       = require('path');
const rateLimit  = require('express-rate-limit');
const router     = express.Router();
const { upload } = require('../middleware/upload');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { toggleLike, getLikeStatus } = require('../controllers/likesController');
const { getTranscript }              = require('../controllers/transcriptController');
const { saveProgress, getProgress }  = require('../controllers/progressController');
const { recordHeatmap, getHeatmap }  = require('../controllers/heatmapController');
const { getAnalytics }               = require('../controllers/analyticsController');
const {
  prepareUpload, finalizeUpload,
  uploadVideo, listVideos, getVideo, getVideoStatus, updateVideo, deleteVideo, uploadThumbnail,
} = require('../controllers/videoController');

const imageUpload = multer({
  dest: path.join(__dirname, '../../temp'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});
function handleImageUpload(req, res, next) {
  imageUpload.single('thumbnail')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 20,
  message: { error: 'Upload limit reached. Try again in an hour.' },
});
const statusLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many status requests.' },
});

function handleUpload(req, res, next) {
  upload.single('video')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

router.get ('/',              requireAuth, listVideos);
router.get ('/:id',           requireAuth, getVideo);
router.get ('/:id/status',     requireAuth, statusLimiter, getVideoStatus);
router.get ('/:id/transcript', requireAuth, getTranscript);
router.get ('/:id/like',       requireAuth, getLikeStatus);
router.get ('/:id/progress',   requireAuth, getProgress);
router.get ('/:id/heatmap',    requireAuth, getHeatmap);
router.get ('/:id/analytics',  requireAuth, getAnalytics);
// New 2-step direct-to-S3 upload (avoids Render's 30-second request timeout)
router.post('/prepare',        requireAuth, uploadLimiter, prepareUpload);
router.post('/upload',         requireAuth, uploadLimiter, handleUpload, uploadVideo);
router.post('/:id/finalize',   requireAuth, finalizeUpload);
router.post('/:id/like',       requireAuth, toggleLike);
router.post('/:id/progress',   requireAuth, saveProgress);
router.post('/:id/heatmap',    requireAuth, recordHeatmap);
router.patch('/:id',           requireAuth, updateVideo);
router.patch('/:id/thumbnail', requireAuth, handleImageUpload, uploadThumbnail);
router.delete('/:id',          requireAuth, deleteVideo);

module.exports = router;

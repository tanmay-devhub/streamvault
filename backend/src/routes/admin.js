const express    = require('express');
const router     = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  getStats, listAllVideos, adminDeleteVideo, deleteAllFailed,
  listUsers, setUserRole,
  suspendUser, liftSuspension,
  getAuditLog,
  listProfiles, adminUpdateProfile, adminDeleteProfile,
} = require('../controllers/adminController');
const { uploadVideo } = require('../controllers/videoController');

router.use(requireAuth, requireAdmin);

// Dashboard
router.get('/stats', getStats);

// Videos
router.get   ('/videos',             listAllVideos);
router.delete('/videos/failed/all',  deleteAllFailed);
router.delete('/videos/:id',         adminDeleteVideo);

function handleUpload(req, res, next) {
  upload.single('video')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}
router.post('/videos/upload', handleUpload, uploadVideo);

// Users
router.get   ('/users',                listUsers);
router.patch ('/users/:id/role',       setUserRole);
router.post  ('/users/:id/suspend',    suspendUser);
router.delete('/users/:id/suspend',    liftSuspension);

// Profiles (channel moderation)
router.get   ('/profiles',            listProfiles);
router.patch ('/profiles/:userId',    adminUpdateProfile);
router.delete('/profiles/:userId',    adminDeleteProfile);

// Audit log
router.get('/audit', getAuditLog);

module.exports = router;

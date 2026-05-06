const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  getMyProfile, createProfile, updateProfile, getProfileByUserId, searchProfiles, deleteMyProfile,
} = require('../controllers/profileController');

router.get   ('/me',      requireAuth, getMyProfile);
router.get   ('/search',  requireAuth, searchProfiles);
router.post  ('/',        requireAuth, createProfile);
router.patch ('/',        requireAuth, updateProfile);
router.delete('/',        requireAuth, deleteMyProfile);
router.get   ('/:userId', requireAuth, getProfileByUserId);

module.exports = router;

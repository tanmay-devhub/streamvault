const express = require('express');
const router  = express.Router();
const { db }        = require('../utils/db');
const { profileDb } = require('../utils/profileDb');
const s3Service     = require('../services/s3Service');
const { clerk }     = require('../middleware/auth');

// Public — no auth required
router.get('/:id', async (req, res) => {
  try {
    const video = await db.findById(req.params.id);
    if (!video || video.privacy === 'private') {
      return res.status(404).json({ error: 'Video not found or not shareable.' });
    }

    // Build a lightweight public payload — no master URL (auth required to stream)
    const payload = {
      id:          video.id,
      title:       video.title,
      description: video.description,
      duration:    video.duration,
      resolution:  video.resolution,
      privacy:     video.privacy,
      createdAt:   video.createdAt,
    };

    if (video.thumbnailKey) {
      payload.thumbnailUrl = await s3Service.getPresignedUrl(video.thumbnailKey, 7 * 24 * 3600);
    }

    if (video.uploaderId) {
      const profile = await profileDb.findByUserId(video.uploaderId);
      if (profile) {
        try {
          const clerkUser = await clerk.users.getUser(video.uploaderId);
          payload.channel = {
            userId:      video.uploaderId,
            channelName: profile.channelName,
            avatarUrl:   profile.avatarUrl || clerkUser.imageUrl || null,
          };
        } catch (_) {
          payload.channel = { userId: video.uploaderId, channelName: profile.channelName, avatarUrl: profile.avatarUrl || null };
        }
      }
    }

    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

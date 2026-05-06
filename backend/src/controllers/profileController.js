const { profileDb } = require('../utils/profileDb');
const { clerk }     = require('../middleware/auth');
const { logger }    = require('../utils/logger');

async function enrichWithClerk(profile, clerkUser) {
  try {
    const user = clerkUser || (await clerk.users.getUser(profile.userId));
    return {
      ...profile,
      clerkImageUrl: user.imageUrl || null,
      clerkName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'User',
    };
  } catch (_) {
    return profile;
  }
}

// GET /api/profile/me
async function getMyProfile(req, res) {
  try {
    const profile = await profileDb.findByUserId(req.auth.userId);
    if (!profile) return res.json(null);
    res.json(await enrichWithClerk(profile, req.auth.clerkUser));
  } catch (err) {
    logger.error(`getMyProfile error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
}

// POST /api/profile
async function createProfile(req, res) {
  const { channelName, bio, avatarUrl } = req.body;
  if (!channelName?.trim()) return res.status(400).json({ error: 'Channel name is required.' });
  try {
    if (await profileDb.findByUserId(req.auth.userId)) {
      return res.status(409).json({ error: 'Profile already exists. Use PATCH to update.' });
    }
    const profile = await profileDb.insert({
      userId:      req.auth.userId,
      channelName: channelName.trim(),
      bio:         (bio || '').trim(),
      avatarUrl:   (avatarUrl || '').trim(),
    });
    res.status(201).json(await enrichWithClerk(profile, req.auth.clerkUser));
  } catch (err) {
    if (profileDb.isUniqueViolation(err)) {
      return res.status(409).json({ error: 'That channel name is already taken.' });
    }
    logger.error(`createProfile error: ${err.message}`);
    res.status(500).json({ error: 'Failed to create channel. Please try again.' });
  }
}

// PATCH /api/profile
async function updateProfile(req, res) {
  const { channelName, bio, avatarUrl } = req.body;
  if (channelName !== undefined && !channelName?.trim()) {
    return res.status(400).json({ error: 'Channel name cannot be empty.' });
  }
  try {
    if (!(await profileDb.findByUserId(req.auth.userId))) {
      return res.status(404).json({ error: 'Profile not found. Create one first.' });
    }
    const fields = {};
    if (channelName !== undefined) fields.channelName = channelName.trim();
    if (bio         !== undefined) fields.bio         = bio.trim();
    if (avatarUrl   !== undefined) fields.avatarUrl   = avatarUrl.trim();
    const updated = await profileDb.update(req.auth.userId, fields);
    res.json(await enrichWithClerk(updated, req.auth.clerkUser));
  } catch (err) {
    if (profileDb.isUniqueViolation(err)) {
      return res.status(409).json({ error: 'That channel name is already taken.' });
    }
    logger.error(`updateProfile error: ${err.message}`);
    res.status(500).json({ error: 'Failed to update channel. Please try again.' });
  }
}

// GET /api/profile/:userId
async function getProfileByUserId(req, res) {
  try {
    const profile = await profileDb.findByUserId(req.params.userId);
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });
    res.json(await enrichWithClerk(profile, null));
  } catch (err) {
    logger.error(`getProfileByUserId error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
}

// GET /api/profile/search?q=
async function searchProfiles(req, res) {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const results = await profileDb.search(q, 10);
    const enriched = await Promise.all(results.map((p) => enrichWithClerk(p, null)));
    res.json(enriched);
  } catch (err) {
    logger.error(`searchProfiles error: ${err.message}`);
    res.status(500).json({ error: 'Search failed.' });
  }
}

// DELETE /api/profile — user deletes their own channel
async function deleteMyProfile(req, res) {
  try {
    const existing = await profileDb.findByUserId(req.auth.userId);
    if (!existing) return res.status(404).json({ error: 'No channel to delete.' });
    await profileDb.delete(req.auth.userId);
    res.json({ message: 'Channel deleted.' });
  } catch (err) {
    logger.error(`deleteMyProfile error: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete channel.' });
  }
}

module.exports = { getMyProfile, createProfile, updateProfile, getProfileByUserId, searchProfiles, deleteMyProfile };

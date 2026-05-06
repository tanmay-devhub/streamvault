const express = require('express');
const router  = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { serveHls }     = require('../controllers/hlsController');

// Optional auth: public/unlisted videos stream without a token (HLS.js
// can't send the Authorization header on its own redirected segment requests).
// Private-video enforcement is done inside serveHls based on req.auth.
router.get('/:videoId/*', optionalAuth, serveHls);

module.exports = router;

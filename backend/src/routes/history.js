const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getHistory }  = require('../controllers/progressController');

router.get('/', requireAuth, getHistory);

module.exports = router;

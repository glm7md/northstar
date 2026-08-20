'use strict';

const router = require('express').Router();
const controller = require('../controllers/storage.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { parseMultipart } = require('../middleware/upload.middleware');
const { uploadLimiter } = require('../middleware/rateLimit.middleware');

router.post('/upload', uploadLimiter, requireAuth, parseMultipart, controller.upload);

module.exports = router;

'use strict';

const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const validate = require('../middleware/validate.middleware');
const { loginSchema } = require('../validators/schemas');
const { requireAuth } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimit.middleware');

router.post('/login', authLimiter, validate(loginSchema), controller.login);
router.get('/me', requireAuth, controller.me);
router.post('/logout', requireAuth, controller.logout);

module.exports = router;
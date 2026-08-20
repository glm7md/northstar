'use strict';

const router = require('express').Router();
const controller = require('../controllers/students.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');

router.get('/me', requireAuth, requireRole('student'), controller.me);

module.exports = router;

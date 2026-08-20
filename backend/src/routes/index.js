'use strict';

const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/courses', require('./courses.routes'));
router.use('/students', require('./students.self.routes'));
router.use('/', require('./quiz.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/storage', require('./storage.routes'));

module.exports = router;

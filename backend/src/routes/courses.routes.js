'use strict';

const router = require('express').Router();
const controller = require('../controllers/courses.controller');
const { optionalAuth } = require('../middleware/auth.middleware');

router.get('/', optionalAuth, controller.listCourses);
router.get('/:courseId', optionalAuth, controller.getCourse);
router.get('/:courseId/lectures/:lectureId', optionalAuth, controller.getLecture);

module.exports = router;

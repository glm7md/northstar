'use strict';

const router = require('express').Router();
const controller = require('../controllers/quiz.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { quizSubmitSchema } = require('../validators/schemas');

router.get('/courses/:courseId/lectures/:lectureId/quiz', requireAuth, controller.getQuiz);
router.post(
  '/courses/:courseId/lectures/:lectureId/quiz/attempts',
  requireAuth,
  validate(quizSubmitSchema),
  controller.submitQuiz
);
router.get('/quiz-attempts/:attemptId', requireAuth, controller.getAttempt);
router.get('/students/me/quiz-attempts', requireAuth, controller.myAttempts);

module.exports = router;

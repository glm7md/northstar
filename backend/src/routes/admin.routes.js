'use strict';

const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');

const coursesController = require('../controllers/admin.courses.controller');
const studentsController = require('../controllers/students.controller');
const quizController = require('../controllers/quiz.controller');
const gradebookController = require('../controllers/gradebook.controller');

const {
  courseCreateSchema,
  courseUpdateSchema,
  lectureCreateSchema,
  lectureUpdateSchema,
  quizUpsertSchema,
  studentCreateSchema,
  studentUpdateSchema,
  enrollmentUpdateSchema,
  publishScoreSchema,
} = require('../validators/schemas');

router.use(requireAuth, requireRole('admin'));

router.get('/courses', coursesController.listCourses);
router.get('/courses/:courseId', coursesController.getCourse);
router.post('/courses', validate(courseCreateSchema), coursesController.createCourse);
router.put('/courses/:courseId', validate(courseUpdateSchema), coursesController.updateCourse);
router.delete('/courses/:courseId', coursesController.deleteCourse);

router.post(
  '/courses/:courseId/lectures',
  validate(lectureCreateSchema),
  coursesController.createLecture
);
router.put(
  '/courses/:courseId/lectures/:lectureId',
  validate(lectureUpdateSchema),
  coursesController.updateLecture
);
router.delete('/courses/:courseId/lectures/:lectureId', coursesController.deleteLecture);

router.put(
  '/courses/:courseId/lectures/:lectureId/quiz',
  validate(quizUpsertSchema),
  coursesController.upsertQuiz
);
router.delete('/courses/:courseId/lectures/:lectureId/quiz', coursesController.deleteQuiz);

router.get('/courses/:courseId/lectures/:lectureId/attempts', quizController.attemptsForLecture);
router.put(
  '/quiz-attempts/:attemptId/publish',
  validate(publishScoreSchema),
  quizController.publishScore
);

router.get('/students', studentsController.listStudents);
router.post('/students', validate(studentCreateSchema), studentsController.createStudent);
router.put('/students/:studentId', validate(studentUpdateSchema), studentsController.updateStudent);
router.delete('/students/:studentId', studentsController.deleteStudent);
router.put(
  '/students/:studentId/enrollment',
  validate(enrollmentUpdateSchema),
  studentsController.updateEnrollment
);

router.get('/grades', gradebookController.getGradesByYear);

module.exports = router;

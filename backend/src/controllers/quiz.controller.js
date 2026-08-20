'use strict';

const asyncHandler = require('../utils/asyncHandler');
const quizService = require('../services/quiz.service');
const studentsRepo = require('../repositories/students.repository');
const AppError = require('../utils/AppError');

async function requireStudentRecord(req) {
  if (req.user.role !== 'student') throw AppError.forbidden('Only students can do that.');
  const student = await studentsRepo.findById(req.user.sub);
  if (!student) throw AppError.unauthorized('Your session is no longer valid.');
  return student;
}

const getQuiz = asyncHandler(async (req, res) => {
  const student = await requireStudentRecord(req);
  const result = await quizService.getQuizForStudent(req.params.courseId, req.params.lectureId, student);
  res.json({ ok: true, ...result });
});

const submitQuiz = asyncHandler(async (req, res) => {
  const student = await requireStudentRecord(req);
  const attempt = await quizService.submitQuizAttempt(
    req.params.courseId,
    req.params.lectureId,
    student,
    req.body.answers
  );
  res.status(201).json({
    ok: true,
    attempt: {
      id: attempt.id,
      mcqScore: attempt.mcqScore,
      mcqTotal: attempt.mcqTotal,
      essayTotal: attempt.essayTotal,
      courseId: attempt.courseId,
    },
  });
});

const getAttempt = asyncHandler(async (req, res) => {
  const attempt = await quizService.getAttemptForUser(req.params.attemptId, req.user);
  res.json({ ok: true, attempt });
});

const myAttempts = asyncHandler(async (req, res) => {
  await requireStudentRecord(req);
  const attempts = await quizService.listMyAttempts(req.user.sub);
  res.json({ ok: true, attempts });
});

const attemptsForLecture = asyncHandler(async (req, res) => {
  const result = await quizService.listAttemptsForLecture(req.params.courseId, req.params.lectureId);
  res.json({ ok: true, ...result });
});

const publishScore = asyncHandler(async (req, res) => {
  const attempt = await quizService.publishScore(req.params.attemptId, req.body.finalScore);
  res.json({ ok: true, attempt });
});

module.exports = { getQuiz, submitQuiz, getAttempt, myAttempts, attemptsForLecture, publishScore };

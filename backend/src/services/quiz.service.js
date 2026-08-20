'use strict';

const coursesService = require('./courses.service');
const attemptsRepo = require('../repositories/quizAttempts.repository');
const AppError = require('../utils/AppError');
const { makeId } = require('../utils/ids');
const { toQuizForAttempt } = require('./sanitizers');
const { lectureUnlockState, isEnrolled } = require('./unlockRules');

async function getQuizForStudent(courseId, lectureId, student) {
  const { course, lecture } = await coursesService.findCourseAndLecture(courseId, lectureId);
  if (!lecture.quiz) throw AppError.notFound('This lecture does not have a quiz.');

  const index = course.lectures.findIndex((l) => l.id === lectureId);
  const attempted = await coursesService.attemptedLectureIdSet(student.id);
  const state = lectureUnlockState(course, index, student, attempted);
  if (!state.unlocked) throw AppError.forbidden('This lecture is locked.', { reason: state.reason });

  const existing = await attemptsRepo.findByStudentAndLecture(student.id, lectureId);
  if (existing) {
    return { alreadyAttempted: true, attemptId: existing.id };
  }

  return { alreadyAttempted: false, quiz: toQuizForAttempt(lecture.quiz) };
}

async function submitQuizAttempt(courseId, lectureId, student, submittedAnswers) {
  const { course, lecture } = await coursesService.findCourseAndLecture(courseId, lectureId);
  if (!lecture.quiz) throw AppError.notFound('This lecture does not have a quiz.');

  const index = course.lectures.findIndex((l) => l.id === lectureId);
  const attempted = await coursesService.attemptedLectureIdSet(student.id);
  const state = lectureUnlockState(course, index, student, attempted);
  if (!state.unlocked) throw AppError.forbidden('This lecture is locked.', { reason: state.reason });

  const existing = await attemptsRepo.findByStudentAndLecture(student.id, lectureId);
  if (existing) throw AppError.conflict('You have already submitted this quiz.');

  const quiz = lecture.quiz;
  const answerByQuestionId = new Map(submittedAnswers.map((a) => [a.questionId, a]));

  for (const q of quiz.questions) {
    const answer = answerByQuestionId.get(q.id);
    if (!answer) throw AppError.badRequest('Please answer all questions before submitting.');
    if (answer.type !== q.type) throw AppError.badRequest('Answer type does not match the question.');
    if (q.type === 'mcq' && !q.options.some((o) => o.id === answer.selectedOptionId)) {
      throw AppError.badRequest('Submitted option does not belong to this question.');
    }
  }

  const mcqQuestions = quiz.questions.filter((q) => q.type === 'mcq');
  const essayQuestions = quiz.questions.filter((q) => q.type === 'essay');
  const mcqScore = mcqQuestions.filter((q) => {
    const answer = answerByQuestionId.get(q.id);
    return answer.selectedOptionId === q.correctOptionId;
  }).length;

  const attempt = {
    id: makeId(),
    studentId: student.id,
    courseId,
    lectureId,
    quizId: quiz.id,
    answers: quiz.questions.map((q) => {
      const answer = answerByQuestionId.get(q.id);
      if (q.type === 'mcq') {
        return { questionId: q.id, type: 'mcq', selectedOptionId: answer.selectedOptionId };
      }
      return {
        questionId: q.id,
        type: 'essay',
        method: answer.method,
        text: answer.method === 'text' ? answer.text || '' : '',
        imageUrl: answer.method === 'image' ? answer.imageUrl || null : null,
      };
    }),
    mcqScore,
    mcqTotal: mcqQuestions.length,
    essayTotal: essayQuestions.length,
    finalScore: null,
    approved: false,
    submittedAt: Date.now(),
  };

  await attemptsRepo.insert(attempt);
  return attempt;
}

async function getAttemptForUser(attemptId, user) {
  const attempt = await attemptsRepo.findById(attemptId);
  if (!attempt) throw AppError.notFound('Result not found.');
  if (user.role === 'admin') return attempt;
  if (user.role === 'student' && attempt.studentId === user.sub) return attempt;
  throw AppError.forbidden();
}

async function listMyAttempts(studentId) {
  return attemptsRepo.findByStudent(studentId);
}

async function listAttemptsForLecture(courseId, lectureId) {
  const { lecture } = await coursesService.findCourseAndLecture(courseId, lectureId);
  if (!lecture.quiz) throw AppError.notFound('This lecture does not have a quiz.');
  const attempts = await attemptsRepo.findByLecture(lectureId);
  return { quiz: lecture.quiz, attempts };
}

async function publishScore(attemptId, finalScore) {
  const attempt = await attemptsRepo.findById(attemptId);
  if (!attempt) throw AppError.notFound('Result not found.');

  const { lecture } = await coursesService.findCourseAndLecture(attempt.courseId, attempt.lectureId);
  const totalPoints = lecture.quiz ? lecture.quiz.questions.length : attempt.mcqTotal + attempt.essayTotal;
  if (finalScore < 0 || finalScore > totalPoints) {
    throw AppError.badRequest(`Enter a score between 0 and ${totalPoints}.`);
  }

  return attemptsRepo.updateById(attemptId, { finalScore, approved: true });
}

module.exports = {
  getQuizForStudent,
  submitQuizAttempt,
  getAttemptForUser,
  listMyAttempts,
  listAttemptsForLecture,
  publishScore,
};

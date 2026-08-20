'use strict';

const coursesRepo = require('../repositories/courses.repository');
const studentsRepo = require('../repositories/students.repository');
const attemptsRepo = require('../repositories/quizAttempts.repository');
const AppError = require('../utils/AppError');
const { makeId } = require('../utils/ids');
const { extractYouTubeId } = require('../utils/youtube');
const { lectureUnlockState, isEnrolled } = require('./unlockRules');
const { toPublicCourseSummary, toLectureListItem, toLectureContent } = require('./sanitizers');

async function resolveCurrentStudent(user) {
  if (!user || user.role !== 'student') return null;
  return studentsRepo.findById(user.sub);
}

async function attemptedLectureIdSet(studentId) {
  if (!studentId) return new Set();
  const attempts = await attemptsRepo.findByStudent(studentId);
  return new Set(attempts.map((a) => a.lectureId));
}


async function listCoursesForYear(year) {
  const courses = await coursesRepo.list();
  const filtered = year ? courses.filter((c) => c.year === year) : courses;
  return filtered.map(toPublicCourseSummary);
}

async function getCourseDetail(courseId, user) {
  const course = await coursesRepo.findById(courseId);
  if (!course) throw AppError.notFound('Course not found.');

  const student = await resolveCurrentStudent(user);
  const attempted = await attemptedLectureIdSet(student?.id);
  const lectures = course.lectures || [];

  return {
    id: course.id,
    title: course.title,
    description: course.description || '',
    year: course.year,
    cover: course.cover || null,
    lectures: lectures.map((lec, index) =>
      toLectureListItem(lec, index, lectureUnlockState(course, index, student, attempted))
    ),
  };
}

async function getLectureForViewing(courseId, lectureId, user) {
  const course = await coursesRepo.findById(courseId);
  if (!course) throw AppError.notFound('Course not found.');
  const lectures = course.lectures || [];
  const index = lectures.findIndex((l) => l.id === lectureId);
  if (index === -1) throw AppError.notFound('Lecture not found.');
  const lecture = lectures[index];

  const student = await resolveCurrentStudent(user);
  const attempted = await attemptedLectureIdSet(student?.id);
  const state = lectureUnlockState(course, index, student, attempted);
  if (!state.unlocked) {
    throw AppError.forbidden('This lecture is locked.', { reason: state.reason });
  }

  let quizStatus = null;
  if (lecture.quiz) {
    const attempt = student ? await attemptsRepo.findByStudentAndLecture(student.id, lectureId) : null;
    quizStatus = attempt
      ? { attempted: true, attemptId: attempt.id, mcqScore: attempt.mcqScore, mcqTotal: attempt.mcqTotal }
      : { attempted: false };
  }

  const nextLecture = lectures[index + 1] || null;
  let nextState = null;
  if (nextLecture) {
    nextState = lectureUnlockState(course, index + 1, student, attempted);
  }

  return {
    course: { id: course.id, title: course.title },
    lecture: toLectureContent(lecture),
    index,
    quizStatus,
    next: nextLecture
      ? { id: nextLecture.id, title: nextLecture.title, unlocked: nextState.unlocked }
      : null,
  };
}


async function adminListCourses(year) {
  const courses = await coursesRepo.list();
  return year ? courses.filter((c) => c.year === year) : courses;
}

async function adminGetCourse(courseId) {
  const course = await coursesRepo.findById(courseId);
  if (!course) throw AppError.notFound('Course not found.');
  return course;
}


async function createCourse({ title, description, year, cover }) {
  const course = {
    id: makeId(),
    title,
    description: description || '',
    year,
    cover: cover || null,
    lectures: [],
  };
  await coursesRepo.insert(course);
  return course;
}

async function updateCourse(courseId, patch) {
  const existing = await coursesRepo.findById(courseId);
  if (!existing) throw AppError.notFound('Course not found.');
  return coursesRepo.updateById(courseId, patch);
}

async function deleteCourse(courseId) {
  const removed = await coursesRepo.removeById(courseId);
  if (!removed) throw AppError.notFound('Course not found.');
}


function resolveVideoId(videoData) {
  if (videoData === undefined) return undefined;
  if (videoData === null || videoData === '') return null;
  const id = extractYouTubeId(videoData);
  if (!id) throw AppError.badRequest('Must be a valid YouTube video URL.');
  return id;
}

async function createLecture(courseId, { title, videoData, pdfData }) {
  const lecture = {
    id: makeId(),
    title,
    videoData: resolveVideoId(videoData) || null,
    pdfData: pdfData || null,
  };

  const created = await coursesRepo.insertLecture(courseId, lecture);
  if (!created) throw AppError.notFound('Course not found.');
  return created;
}

async function updateLecture(courseId, lectureId, patch) {
  const normalized = { ...patch };
  if (Object.prototype.hasOwnProperty.call(patch, 'videoData')) {
    normalized.videoData = resolveVideoId(patch.videoData);
  }
  const updated = await coursesRepo.updateLectureById(courseId, lectureId, normalized);
  if (!updated) throw AppError.notFound('Course or lecture not found.');
  return updated;
}

async function deleteLecture(courseId, lectureId) {
  const removed = await coursesRepo.removeLectureById(courseId, lectureId);
  if (!removed) throw AppError.notFound('Course or lecture not found.');
}

async function upsertLectureQuiz(courseId, lectureId, { id, questions }) {
  const updated = await coursesRepo.upsertQuiz(courseId, lectureId, { id, questions });
  if (!updated) throw AppError.notFound('Course or lecture not found.');
  return updated;
}

async function deleteLectureQuiz(courseId, lectureId) {
  const found = await coursesRepo.removeQuizByLecture(courseId, lectureId);
  if (!found) throw AppError.notFound('Course or lecture not found.');
}

async function findCourseAndLecture(courseId, lectureId) {
  const course = await coursesRepo.findById(courseId);
  if (!course) throw AppError.notFound('Course not found.');
  const lecture = (course.lectures || []).find((l) => l.id === lectureId);
  if (!lecture) throw AppError.notFound('Lecture not found.');
  return { course, lecture };
}

module.exports = {
  resolveCurrentStudent,
  attemptedLectureIdSet,
  listCoursesForYear,
  getCourseDetail,
  getLectureForViewing,
  adminListCourses,
  adminGetCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  createLecture,
  updateLecture,
  deleteLecture,
  upsertLectureQuiz,
  deleteLectureQuiz,
  findCourseAndLecture,
  isEnrolled,
};
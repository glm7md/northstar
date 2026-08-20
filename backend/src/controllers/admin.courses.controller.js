'use strict';

const asyncHandler = require('../utils/asyncHandler');
const coursesService = require('../services/courses.service');

const listCourses = asyncHandler(async (req, res) => {
  const courses = await coursesService.adminListCourses(req.query.year);
  res.json({ ok: true, courses });
});

const getCourse = asyncHandler(async (req, res) => {
  const course = await coursesService.adminGetCourse(req.params.courseId);
  res.json({ ok: true, course });
});

const createCourse = asyncHandler(async (req, res) => {
  const course = await coursesService.createCourse(req.body);
  res.status(201).json({ ok: true, course });
});

const updateCourse = asyncHandler(async (req, res) => {
  const course = await coursesService.updateCourse(req.params.courseId, req.body);
  res.json({ ok: true, course });
});

const deleteCourse = asyncHandler(async (req, res) => {
  await coursesService.deleteCourse(req.params.courseId);
  res.json({ ok: true });
});

const createLecture = asyncHandler(async (req, res) => {
  const lecture = await coursesService.createLecture(req.params.courseId, req.body);
  res.status(201).json({ ok: true, lecture });
});

const updateLecture = asyncHandler(async (req, res) => {
  const lecture = await coursesService.updateLecture(req.params.courseId, req.params.lectureId, req.body);
  res.json({ ok: true, lecture });
});

const deleteLecture = asyncHandler(async (req, res) => {
  await coursesService.deleteLecture(req.params.courseId, req.params.lectureId);
  res.json({ ok: true });
});

const upsertQuiz = asyncHandler(async (req, res) => {
  const quiz = await coursesService.upsertLectureQuiz(req.params.courseId, req.params.lectureId, req.body);
  res.json({ ok: true, quiz });
});

const deleteQuiz = asyncHandler(async (req, res) => {
  await coursesService.deleteLectureQuiz(req.params.courseId, req.params.lectureId);
  res.json({ ok: true });
});

module.exports = {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  createLecture,
  updateLecture,
  deleteLecture,
  upsertQuiz,
  deleteQuiz,
};

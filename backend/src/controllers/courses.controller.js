'use strict';

const asyncHandler = require('../utils/asyncHandler');
const coursesService = require('../services/courses.service');

const listCourses = asyncHandler(async (req, res) => {
  const courses = await coursesService.listCoursesForYear(req.query.year);
  res.json({ ok: true, courses });
});

const getCourse = asyncHandler(async (req, res) => {
  const course = await coursesService.getCourseDetail(req.params.courseId, req.user || null);
  res.json({ ok: true, course });
});

const getLecture = asyncHandler(async (req, res) => {
  const result = await coursesService.getLectureForViewing(
    req.params.courseId,
    req.params.lectureId,
    req.user || null
  );
  res.json({ ok: true, ...result });
});

module.exports = { listCourses, getCourse, getLecture };

'use strict';

const asyncHandler = require('../utils/asyncHandler');
const studentsService = require('../services/students.service');

const listStudents = asyncHandler(async (req, res) => {
  const students = await studentsService.listStudents();
  res.json({ ok: true, students });
});

const createStudent = asyncHandler(async (req, res) => {
  const student = await studentsService.createStudent(req.body);
  res.status(201).json({ ok: true, student });
});

const updateStudent = asyncHandler(async (req, res) => {
  const student = await studentsService.updateStudent(req.params.studentId, req.body);
  res.json({ ok: true, student });
});

const deleteStudent = asyncHandler(async (req, res) => {
  await studentsService.deleteStudent(req.params.studentId);
  res.json({ ok: true });
});

const updateEnrollment = asyncHandler(async (req, res) => {
  const student = await studentsService.updateEnrollment(req.params.studentId, req.body.courseIds);
  res.json({ ok: true, student });
});

const me = asyncHandler(async (req, res) => {
  const student = await studentsService.getMe(req.user.sub);
  res.json({ ok: true, student });
});

module.exports = { listStudents, createStudent, updateStudent, deleteStudent, updateEnrollment, me };

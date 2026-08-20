'use strict';

const studentsRepo = require('../repositories/students.repository');
const coursesRepo = require('../repositories/courses.repository');
const AppError = require('../utils/AppError');
const { makeId } = require('../utils/ids');
const { hashPassword } = require('../utils/password');

function toPublicStudent(student) {
  return {
    id: student.id,
    name: student.name,
    email: student.email,
    username: student.username,
    year: student.year,
    enrolledCourseIds: student.enrolledCourseIds || [],
  };
}

async function listStudents() {
  const students = await studentsRepo.list();
  return students.map(toPublicStudent);
}

async function getMe(studentId) {
  const student = await studentsRepo.findById(studentId);
  if (!student) throw AppError.notFound('Student not found.');
  return toPublicStudent(student);
}

async function createStudent({ name, email, password, year }) {
  const existing = await studentsRepo.findByIdentifier(email);
  if (existing) throw AppError.conflict('A student with this email/username already exists.');

  const passwordHash = await hashPassword(password);
  const student = {
    id: makeId(),
    name,
    username: email,
    email,
    passwordHash,
    year,
    enrolledCourseIds: [],
    createdAt: Date.now(),
  };
  await studentsRepo.insert(student);
  return toPublicStudent(student);
}

async function updateStudent(studentId, { email, username, year, password }) {
  const student = await studentsRepo.findById(studentId);
  if (!student) throw AppError.notFound('Student not found.');

  for (const identifier of [email, username]) {
    const existing = await studentsRepo.findByIdentifier(identifier);
    if (existing && existing.id !== studentId) {
      throw AppError.conflict('A student with this email/username already exists.');
    }
  }

  const patch = { email, username, year };
  if (password) patch.passwordHash = await hashPassword(password);

  const updated = await studentsRepo.updateById(studentId, patch);
  return toPublicStudent(updated);
}

async function deleteStudent(studentId) {
  const removed = await studentsRepo.removeById(studentId);
  if (!removed) throw AppError.notFound('Student not found.');
}

async function updateEnrollment(studentId, courseIds) {
  const student = await studentsRepo.findById(studentId);
  if (!student) throw AppError.notFound('Student not found.');

  const allCourses = await coursesRepo.list();
  const validIds = new Set(allCourses.map((c) => c.id));
  const invalid = courseIds.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    throw AppError.badRequest('One or more course IDs do not exist.', { invalid });
  }

  const updated = await studentsRepo.updateById(studentId, { enrolledCourseIds: courseIds });
  return toPublicStudent(updated);
}

module.exports = { listStudents, getMe, createStudent, updateStudent, deleteStudent, updateEnrollment, toPublicStudent };

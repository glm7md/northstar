'use strict';

const adminsRepo = require('../repositories/admins.repository');
const studentsRepo = require('../repositories/students.repository');
const AppError = require('../utils/AppError');
const { verifyPassword } = require('../utils/password');
const { signToken, decodeToken } = require('../utils/jwt');
const { makeId } = require('../utils/ids');
const { toPublicStudent } = require('./students.service');

async function login(identifier, password) {
  const admin = await adminsRepo.findByUsername(identifier);
  if (admin) {
    const ok = await verifyPassword(password, admin.passwordHash);
    if (ok) {
      const token = signToken({ sub: admin.id, role: 'admin', name: 'System Admin' });
      return { token, user: { id: admin.id, role: 'admin', name: 'System Admin' } };
    }
  }

  const student = await studentsRepo.findByIdentifier(identifier);
  if (student) {
    const ok = await verifyPassword(password, student.passwordHash);
    if (ok) {
      const now = Date.now();
      if (student.activeSessionId && student.activeSessionExpiresAt && student.activeSessionExpiresAt > now) {
        throw AppError.conflict('This account is already signed in on another device. Please sign out there first.');
      }

      const sessionId = makeId();
      const token = signToken({ sub: student.id, role: 'student', name: student.name, sid: sessionId });
      const decoded = decodeToken(token);
      const expiresAt = decoded && decoded.exp ? decoded.exp * 1000 : now + 12 * 60 * 60 * 1000;
      await studentsRepo.setActiveSession(student.id, sessionId, expiresAt);

      return { token, user: { ...toPublicStudent(student), role: 'student' } };
    }
  }

  throw AppError.unauthorized('Invalid credentials. Please try again.');
}

async function getCurrentUser(authUser) {
  if (authUser.role === 'admin') {
    return { id: authUser.sub, role: 'admin', name: 'System Admin' };
  }
  const student = await studentsRepo.findById(authUser.sub);
  if (!student) throw AppError.unauthorized('Your session is no longer valid.');
  return { ...toPublicStudent(student), role: 'student' };
}

async function logout(authUser) {
  if (authUser && authUser.role === 'student' && authUser.sid) {
    await studentsRepo.clearActiveSession(authUser.sub, authUser.sid);
  }
}

module.exports = { login, getCurrentUser, logout };
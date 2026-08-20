'use strict';

const { verifyToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const studentsRepo = require('../repositories/students.repository');

function extractToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) return token;
  return null;
}

async function isSessionValid(payload) {
  if (payload.role !== 'student') return true;
  const session = await studentsRepo.getSessionInfo(payload.sub);
  if (!session || !session.activeSessionId || !session.activeSessionExpiresAt) return false;
  if (session.activeSessionId !== payload.sid) return false;
  return session.activeSessionExpiresAt > Date.now();
}

async function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    if (await isSessionValid(payload)) {
      req.user = payload;
    }
  } catch {
  }
  next();
}

async function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next(AppError.unauthorized());
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return next(AppError.unauthorized('Your session has expired. Please sign in again.'));
  }

  try {
    if (!(await isSessionValid(payload))) {
      return next(AppError.unauthorized('Your session has expired. Please sign in again.'));
    }
  } catch (err) {
    return next(err);
  }

  req.user = payload;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
}

module.exports = { optionalAuth, requireAuth, requireRole };
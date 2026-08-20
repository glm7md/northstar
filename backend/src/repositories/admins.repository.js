'use strict';

const db = require('../config/db');
const { hashPassword } = require('../utils/password');
const { makeId } = require('../utils/ids');
const env = require('../config/env');
const logger = require('../utils/logger');

function toAdmin(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    createdAt: Number(row.created_at),
  };
}

async function findByUsername(username) {
  const { rows } = await db.query(
    'SELECT * FROM admins WHERE LOWER(username) = LOWER($1) LIMIT 1',
    [String(username || '')]
  );
  return toAdmin(rows[0]);
}

async function ensureSeedAdmin() {
  const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM admins');
  if (rows[0].count > 0) return;

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  const admin = {
    id: makeId(),
    username: env.ADMIN_USERNAME,
    passwordHash,
    createdAt: Date.now(),
  };
  await db.query(
    'INSERT INTO admins (id, username, password_hash, created_at) VALUES ($1, $2, $3, $4)',
    [admin.id, admin.username, admin.passwordHash, admin.createdAt]
  );
  logger.info({ username: admin.username }, '[seed] Created initial admin account');
  if (env.NODE_ENV !== 'production' && env.ADMIN_PASSWORD === 'admin123') {
    logger.warn('[seed] Using the default admin password. Set ADMIN_PASSWORD in .env before deploying.');
  }
}

module.exports = { findByUsername, ensureSeedAdmin };

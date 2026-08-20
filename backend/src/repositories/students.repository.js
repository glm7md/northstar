'use strict';

const db = require('../config/db');

function toStudent(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    username: row.username,
    passwordHash: row.password_hash,
    year: row.year,
    createdAt: Number(row.created_at),
    enrolledCourseIds: row.enrolled_course_ids || [],
    activeSessionId: row.active_session_id || null,
    activeSessionExpiresAt: row.active_session_expires_at ? Number(row.active_session_expires_at) : null,
  };
}

async function attachEnrollments(rows) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const { rows: enrollmentRows } = await db.query(
    `SELECT student_id, course_id FROM enrollments WHERE student_id IN (${db.placeholders(ids.length)})`,
    ids
  );
  const byStudent = new Map();
  for (const e of enrollmentRows) {
    if (!byStudent.has(e.student_id)) byStudent.set(e.student_id, []);
    byStudent.get(e.student_id).push(e.course_id);
  }
  return rows.map((r) => toStudent({ ...r, enrolled_course_ids: byStudent.get(r.id) || [] }));
}

async function list() {
  // Older installations may have a copy of the administrator in `students`.
  // Admins belong only in the `admins` table, so never return those legacy
  // records in student-facing admin lists or grade reports.
  const [{ rows }, { rows: adminRows }] = await Promise.all([
    db.query('SELECT * FROM students ORDER BY created_at ASC'),
    db.query('SELECT username FROM admins'),
  ]);
  const adminUsernames = new Set(adminRows.map((admin) => String(admin.username).toLowerCase()));
  const studentRows = rows.filter((student) => {
    const username = String(student.username || '').toLowerCase();
    const email = String(student.email || '').toLowerCase();
    return !adminUsernames.has(username) && !adminUsernames.has(email);
  });
  return attachEnrollments(studentRows);
}

async function findById(studentId) {
  const { rows } = await db.query('SELECT * FROM students WHERE id = $1', [studentId]);
  if (rows.length === 0) return null;
  const [student] = await attachEnrollments(rows);
  return student;
}

async function findByIdentifier(identifier) {
  const lower = String(identifier || '').toLowerCase();
  const { rows } = await db.query(
    'SELECT * FROM students WHERE LOWER(email) = $1 OR LOWER(username) = $1 LIMIT 1',
    [lower]
  );
  if (rows.length === 0) return null;
  const [student] = await attachEnrollments(rows);
  return student;
}

async function insert(student) {
  await db.query(
    `INSERT INTO students (id, name, email, username, password_hash, year, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [student.id, student.name, student.email, student.username, student.passwordHash, student.year, student.createdAt]
  );
  return student;
}

async function updateById(studentId, patch) {
  const existing = await findById(studentId);
  if (!existing) return null;

  if (Object.prototype.hasOwnProperty.call(patch, 'enrolledCourseIds')) {
    await db.withTransaction(async (client) => {
      await client.query('DELETE FROM enrollments WHERE student_id = $1', [studentId]);
      for (const courseId of patch.enrolledCourseIds) {
        await client.query(
          'INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [studentId, courseId]
        );
      }
    });
  }

  const columnPatch = { ...patch };
  delete columnPatch.enrolledCourseIds;
  const fields = Object.keys(columnPatch);
  if (fields.length > 0) {
    const columnMap = { name: 'name', email: 'email', username: 'username', passwordHash: 'password_hash', year: 'year' };
    const setClauses = fields.map((f, i) => `${columnMap[f] || f} = $${i + 2}`);
    await db.query(
      `UPDATE students SET ${setClauses.join(', ')} WHERE id = $1`,
      [studentId, ...fields.map((f) => columnPatch[f])]
    );
  }

  return findById(studentId);
}

async function removeById(studentId) {
  const { rowCount } = await db.query('DELETE FROM students WHERE id = $1', [studentId]);
  return rowCount > 0;
}

async function getSessionInfo(studentId) {
  const { rows } = await db.query(
    'SELECT active_session_id, active_session_expires_at FROM students WHERE id = $1',
    [studentId]
  );
  if (rows.length === 0) return null;
  return {
    activeSessionId: rows[0].active_session_id || null,
    activeSessionExpiresAt: rows[0].active_session_expires_at ? Number(rows[0].active_session_expires_at) : null,
  };
}

async function setActiveSession(studentId, sessionId, expiresAt) {
  await db.query(
    'UPDATE students SET active_session_id = $2, active_session_expires_at = $3 WHERE id = $1',
    [studentId, sessionId, expiresAt]
  );
}

async function clearActiveSession(studentId, sessionId) {
  await db.query(
    'UPDATE students SET active_session_id = NULL, active_session_expires_at = NULL WHERE id = $1 AND active_session_id = $2',
    [studentId, sessionId]
  );
}

module.exports = {
  list,
  findById,
  findByIdentifier,
  insert,
  updateById,
  removeById,
  getSessionInfo,
  setActiveSession,
  clearActiveSession,
};

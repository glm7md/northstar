'use strict';

const db = require('../config/db');

function toAnswer(row) {
  if (row.type === 'mcq') {
    return { questionId: row.question_id, type: 'mcq', selectedOptionId: row.selected_option_id };
  }
  return {
    questionId: row.question_id,
    type: 'essay',
    method: row.method,
    text: row.text_answer || '',
    imageUrl: row.image_url || null,
  };
}

function toAttempt(row, answers) {
  return {
    id: row.id,
    studentId: row.student_id,
    courseId: row.course_id,
    lectureId: row.lecture_id,
    quizId: row.quiz_id,
    answers,
    mcqScore: row.mcq_score,
    mcqTotal: row.mcq_total,
    essayTotal: row.essay_total,
    finalScore: row.final_score === null ? null : Number(row.final_score),
    approved: row.approved,
    submittedAt: Number(row.submitted_at),
  };
}

async function attachAnswers(rows) {
  if (rows.length === 0) return [];
  const attemptIds = rows.map((r) => r.id);
  const { rows: answerRows } = await db.query(
    `SELECT * FROM quiz_attempt_answers WHERE attempt_id IN (${db.placeholders(attemptIds.length)}) ORDER BY position ASC`,
    attemptIds
  );
  const byAttempt = new Map();
  for (const a of answerRows) {
    if (!byAttempt.has(a.attempt_id)) byAttempt.set(a.attempt_id, []);
    byAttempt.get(a.attempt_id).push(toAnswer(a));
  }
  return rows.map((r) => toAttempt(r, byAttempt.get(r.id) || []));
}

async function list() {
  const { rows } = await db.query('SELECT * FROM quiz_attempts ORDER BY submitted_at DESC');
  return attachAnswers(rows);
}

async function findById(attemptId) {
  const { rows } = await db.query('SELECT * FROM quiz_attempts WHERE id = $1', [attemptId]);
  if (rows.length === 0) return null;
  const [attempt] = await attachAnswers(rows);
  return attempt;
}

async function findByStudentAndLecture(studentId, lectureId) {
  const { rows } = await db.query(
    'SELECT * FROM quiz_attempts WHERE student_id = $1 AND lecture_id = $2 LIMIT 1',
    [studentId, lectureId]
  );
  if (rows.length === 0) return null;
  const [attempt] = await attachAnswers(rows);
  return attempt;
}

async function findByStudent(studentId) {
  const { rows } = await db.query(
    'SELECT * FROM quiz_attempts WHERE student_id = $1 ORDER BY submitted_at DESC',
    [studentId]
  );
  return attachAnswers(rows);
}

async function findByLecture(lectureId) {
  const { rows } = await db.query(
    'SELECT * FROM quiz_attempts WHERE lecture_id = $1 ORDER BY submitted_at DESC',
    [lectureId]
  );
  return attachAnswers(rows);
}

async function insert(attempt) {
  await db.withTransaction(async (client) => {
    await client.query(
      `INSERT INTO quiz_attempts
         (id, student_id, course_id, lecture_id, quiz_id, mcq_score, mcq_total, essay_total, final_score, approved, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        attempt.id,
        attempt.studentId,
        attempt.courseId,
        attempt.lectureId,
        attempt.quizId,
        attempt.mcqScore,
        attempt.mcqTotal,
        attempt.essayTotal,
        attempt.finalScore,
        attempt.approved,
        attempt.submittedAt,
      ]
    );

    for (let i = 0; i < attempt.answers.length; i += 1) {
      const a = attempt.answers[i];
      const isMcq = a.type === 'mcq';
      await client.query(
        `INSERT INTO quiz_attempt_answers
           (id, attempt_id, question_id, type, selected_option_id, method, text_answer, image_url, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          `${attempt.id}:${a.questionId}`,
          attempt.id,
          a.questionId,
          a.type,
          isMcq ? a.selectedOptionId : null,
          isMcq ? null : a.method,
          isMcq ? null : a.text,
          isMcq ? null : a.imageUrl,
          i,
        ]
      );
    }
  });
  return attempt;
}

async function updateById(attemptId, patch) {
  const columnMap = { finalScore: 'final_score', approved: 'approved' };
  const fields = Object.keys(patch).filter((f) => columnMap[f]);
  if (fields.length > 0) {
    const setClauses = fields.map((f, i) => `${columnMap[f]} = $${i + 2}`);
    await db.query(`UPDATE quiz_attempts SET ${setClauses.join(', ')} WHERE id = $1`, [
      attemptId,
      ...fields.map((f) => patch[f]),
    ]);
  }
  return findById(attemptId);
}

module.exports = {
  list,
  findById,
  findByStudentAndLecture,
  findByStudent,
  findByLecture,
  insert,
  updateById,
};

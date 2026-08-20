'use strict';

const db = require('../config/db');
const { makeId } = require('../utils/ids');


function toCourseRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    year: row.year,
    cover: row.cover || null,
  };
}

function toLectureRow(row) {
  return {
    id: row.id,
    title: row.title,
    videoData: row.video_data || null,
    pdfData: row.pdf_data || null,
    quiz: null,
  };
}

function toQuestion(row, options) {
  const base = { id: row.id, type: row.type, imageUrl: row.image_url || null };
  if (row.type === 'mcq') {
    return { ...base, correctOptionId: row.correct_option_id, options };
  }
  return base;
}

async function assembleCourses(courseIds) {
  if (courseIds.length === 0) return [];

  const [coursesRes, lecturesRes] = await Promise.all([
    db.query(`SELECT * FROM courses WHERE id IN (${db.placeholders(courseIds.length)})`, courseIds),
    db.query(
      `SELECT * FROM lectures WHERE course_id IN (${db.placeholders(courseIds.length)}) ORDER BY position ASC`,
      courseIds
    ),
  ]);

  const lectureIds = lecturesRes.rows.map((l) => l.id);
  const quizzesRes = lectureIds.length
    ? await db.query(`SELECT * FROM quizzes WHERE lecture_id IN (${db.placeholders(lectureIds.length)})`, lectureIds)
    : { rows: [] };

  const quizIds = quizzesRes.rows.map((q) => q.id);
  const [questionsRes, optionsRes] = quizIds.length
    ? await Promise.all([
        db.query(
          `SELECT * FROM quiz_questions WHERE quiz_id IN (${db.placeholders(quizIds.length)}) ORDER BY position ASC`,
          quizIds
        ),
        db.query(
          `SELECT o.* FROM quiz_options o
           JOIN quiz_questions q ON q.id = o.question_id
           WHERE q.quiz_id IN (${db.placeholders(quizIds.length)}) ORDER BY o.position ASC`,
          quizIds
        ),
      ])
    : [{ rows: [] }, { rows: [] }];

  const optionsByQuestion = new Map();
  for (const o of optionsRes.rows) {
    if (!optionsByQuestion.has(o.question_id)) optionsByQuestion.set(o.question_id, []);
    optionsByQuestion.get(o.question_id).push({ id: o.id, label: o.label });
  }

  const questionsByQuiz = new Map();
  for (const q of questionsRes.rows) {
    if (!questionsByQuiz.has(q.quiz_id)) questionsByQuiz.set(q.quiz_id, []);
    questionsByQuiz.get(q.quiz_id).push(toQuestion(q, optionsByQuestion.get(q.id) || []));
  }

  const quizByLecture = new Map();
  for (const q of quizzesRes.rows) {
    quizByLecture.set(q.lecture_id, { id: q.id, questions: questionsByQuiz.get(q.id) || [] });
  }

  const lecturesByCourse = new Map();
  for (const l of lecturesRes.rows) {
    const lecture = toLectureRow(l);
    lecture.quiz = quizByLecture.get(l.id) || null;
    if (!lecturesByCourse.has(l.course_id)) lecturesByCourse.set(l.course_id, []);
    lecturesByCourse.get(l.course_id).push(lecture);
  }

  return coursesRes.rows.map((c) => ({
    ...toCourseRow(c),
    lectures: lecturesByCourse.get(c.id) || [],
  }));
}


async function list() {
  const { rows } = await db.query('SELECT id FROM courses ORDER BY created_at ASC');
  return assembleCourses(rows.map((r) => r.id));
}

async function findById(courseId) {
  const courses = await assembleCourses([courseId]);
  return courses[0] || null;
}

async function insert(course) {
  await db.query(
    `INSERT INTO courses (id, title, description, year, cover, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [course.id, course.title, course.description || '', course.year, course.cover || null, Date.now()]
  );
  return course;
}

async function updateById(courseId, patch) {
  const columnMap = { title: 'title', description: 'description', year: 'year', cover: 'cover' };
  const fields = Object.keys(patch).filter((f) => columnMap[f]);
  if (fields.length > 0) {
    const setClauses = fields.map((f, i) => `${columnMap[f]} = $${i + 2}`);
    await db.query(`UPDATE courses SET ${setClauses.join(', ')} WHERE id = $1`, [
      courseId,
      ...fields.map((f) => patch[f]),
    ]);
  }
  return findById(courseId);
}

async function removeById(courseId) {
  const { rowCount } = await db.query('DELETE FROM courses WHERE id = $1', [courseId]);
  return rowCount > 0;
}


async function insertLecture(courseId, lecture) {
  const { rows } = await db.query('SELECT id FROM courses WHERE id = $1', [courseId]);
  if (rows.length === 0) return null;

  const { rows: posRows } = await db.query(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM lectures WHERE course_id = $1',
    [courseId]
  );
  const position = posRows[0].next_position;

  await db.query(
    `INSERT INTO lectures (id, course_id, title, video_data, pdf_data, position, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      lecture.id,
      courseId,
      lecture.title,
      lecture.videoData || null,
      lecture.pdfData || null,
      position,
      Date.now(),
    ]
  );
  return { ...lecture, quiz: null };
}

async function updateLectureById(courseId, lectureId, patch) {
  const columnMap = { title: 'title', videoData: 'video_data', pdfData: 'pdf_data' };
  const fields = Object.keys(patch).filter((f) => columnMap[f]);
  if (fields.length > 0) {
    const setClauses = fields.map((f, i) => `${columnMap[f]} = $${i + 3}`);
    await db.query(
      `UPDATE lectures SET ${setClauses.join(', ')} WHERE id = $1 AND course_id = $2`,
      [lectureId, courseId, ...fields.map((f) => patch[f])]
    );
  }
  const course = await findById(courseId);
  return course ? course.lectures.find((l) => l.id === lectureId) || null : null;
}

async function removeLectureById(courseId, lectureId) {
  const { rowCount } = await db.query('DELETE FROM lectures WHERE id = $1 AND course_id = $2', [lectureId, courseId]);
  return rowCount > 0;
}


async function upsertQuiz(courseId, lectureId, { id, questions }) {
  const { rows: lectureRows } = await db.query(
    'SELECT id FROM lectures WHERE id = $1 AND course_id = $2',
    [lectureId, courseId]
  );
  if (lectureRows.length === 0) return null;

  const quizId = id || makeId();

  await db.withTransaction(async (client) => {
    await client.query('DELETE FROM quizzes WHERE lecture_id = $1', [lectureId]);
    await client.query('INSERT INTO quizzes (id, lecture_id) VALUES ($1, $2)', [quizId, lectureId]);

    for (let qIndex = 0; qIndex < questions.length; qIndex += 1) {
      const q = questions[qIndex];
      await client.query(
        `INSERT INTO quiz_questions (id, quiz_id, type, image_url, correct_option_id, position)
         VALUES ($1, $2, $3, $4, NULL, $5)`,
        [q.id, quizId, q.type, q.imageUrl || null, qIndex]
      );

      if (q.type === 'mcq') {
        for (let oIndex = 0; oIndex < q.options.length; oIndex += 1) {
          const o = q.options[oIndex];
          await client.query(
            'INSERT INTO quiz_options (id, question_id, label, position) VALUES ($1, $2, $3, $4)',
            [o.id, q.id, o.label, oIndex]
          );
        }
        await client.query('UPDATE quiz_questions SET correct_option_id = $1 WHERE id = $2', [
          q.correctOptionId,
          q.id,
        ]);
      }
    }
  });

  const course = await findById(courseId);
  const lecture = course.lectures.find((l) => l.id === lectureId);
  return lecture.quiz;
}

async function removeQuizByLecture(courseId, lectureId) {
  const { rows: lectureRows } = await db.query(
    'SELECT id FROM lectures WHERE id = $1 AND course_id = $2',
    [lectureId, courseId]
  );
  if (lectureRows.length === 0) return false;
  await db.query('DELETE FROM quizzes WHERE lecture_id = $1', [lectureId]);
  return true;
}

module.exports = {
  list,
  findById,
  insert,
  updateById,
  removeById,
  insertLecture,
  updateLectureById,
  removeLectureById,
  upsertQuiz,
  removeQuizByLecture,
};

'use strict';

const request = require('supertest');
const { buildApp, loginAs } = require('./helpers');

describe('Quiz lifecycle and access control', () => {
  let app;
  let adminToken;
  let studentToken;
  let courseId;
  let lecture1Id;
  let lecture2Id;

  beforeAll(async () => {
    app = await buildApp();
    adminToken = (await loginAs(app, 'admin', 'admin123')).token;

    const course = (
      await request(app)
        .post('/api/admin/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Chemistry 101', year: 'Second Year' })
    ).body.course;
    courseId = course.id;

    const lec1 = (
      await request(app)
        .post(`/api/admin/courses/${courseId}/lectures`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Atoms' })
    ).body.lecture;
    lecture1Id = lec1.id;

    await request(app)
      .put(`/api/admin/courses/${courseId}/lectures/${lecture1Id}/quiz`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        questions: [
          {
            id: 'q1',
            type: 'mcq',
            imageUrl: 'https://example.com/q1.png',
            options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
            correctOptionId: 'a',
          },
        ],
      });

    const lec2 = (
      await request(app)
        .post(`/api/admin/courses/${courseId}/lectures`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Molecules' })
    ).body.lecture;
    lecture2Id = lec2.id;

    await request(app)
      .post('/api/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Quiz Taker', email: 'quiztaker@example.com', password: 'abcd1234', year: 'Second Year' });

    const studentRecord = (
      await request(app).get('/api/admin/students').set('Authorization', `Bearer ${adminToken}`)
    ).body.students.find((s) => s.email === 'quiztaker@example.com');

    await request(app)
      .put(`/api/admin/students/${studentRecord.id}/enrollment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ courseIds: [courseId] });

    studentToken = (await loginAs(app, 'quiztaker@example.com', 'abcd1234')).token;
  });

  test('lecture 2 is locked before the lecture 1 quiz is completed', async () => {
    const res = await request(app)
      .get(`/api/courses/${courseId}/lectures/${lecture2Id}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
    expect(res.body.details.reason).toBe('quiz');
  });

  test('the quiz payload sent to a student never includes the correct answer', async () => {
    const res = await request(app)
      .get(`/api/courses/${courseId}/lectures/${lecture1Id}/quiz`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    const question = res.body.quiz.questions[0];
    expect(question.correctOptionId).toBeUndefined();
    expect(question.options).toEqual([{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]);
  });

  test('submitting a wrong answer is graded 0 server-side even if the client claims otherwise', async () => {
    const res = await request(app)
      .post(`/api/courses/${courseId}/lectures/${lecture1Id}/quiz/attempts`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers: [{ questionId: 'q1', type: 'mcq', selectedOptionId: 'b' }] });

    expect(res.status).toBe(201);
    expect(res.body.attempt.mcqScore).toBe(0);
    expect(res.body.attempt.mcqTotal).toBe(1);
  });

  test('lecture 2 unlocks automatically once the quiz attempt exists', async () => {
    const res = await request(app)
      .get(`/api/courses/${courseId}/lectures/${lecture2Id}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
  });

  test('a second attempt on the same quiz is rejected', async () => {
    const res = await request(app)
      .post(`/api/courses/${courseId}/lectures/${lecture1Id}/quiz/attempts`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers: [{ questionId: 'q1', type: 'mcq', selectedOptionId: 'a' }] });
    expect(res.status).toBe(409);
  });

  test('admin can see the submission and publish a final score', async () => {
    const list = await request(app)
      .get(`/api/admin/courses/${courseId}/lectures/${lecture1Id}/attempts`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.attempts).toHaveLength(1);
    const attemptId = list.body.attempts[0].id;

    const publish = await request(app)
      .put(`/api/admin/quiz-attempts/${attemptId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ finalScore: 1 });
    expect(publish.status).toBe(200);
    expect(publish.body.attempt.approved).toBe(true);

    const myResults = await request(app)
      .get('/api/students/me/quiz-attempts')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(myResults.body.attempts[0].finalScore).toBe(1);
    expect(myResults.body.attempts[0].approved).toBe(true);
  });

  test('a rejected publish score outside the valid range is rejected', async () => {
    const list = await request(app)
      .get(`/api/admin/courses/${courseId}/lectures/${lecture1Id}/attempts`)
      .set('Authorization', `Bearer ${adminToken}`);
    const attemptId = list.body.attempts[0].id;

    const publish = await request(app)
      .put(`/api/admin/quiz-attempts/${attemptId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ finalScore: 99 });
    expect(publish.status).toBe(400);
  });

  test('another student cannot view this student’s quiz attempt', async () => {
    await request(app)
      .post('/api/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Other Student', email: 'other@example.com', password: 'abcd1234', year: 'Second Year' });
    const otherToken = (await loginAs(app, 'other@example.com', 'abcd1234')).token;

    const list = await request(app)
      .get(`/api/admin/courses/${courseId}/lectures/${lecture1Id}/attempts`)
      .set('Authorization', `Bearer ${adminToken}`);
    const attemptId = list.body.attempts[0].id;

    const res = await request(app)
      .get(`/api/quiz-attempts/${attemptId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });
});

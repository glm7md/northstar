'use strict';

const request = require('supertest');
const { buildApp, loginAs } = require('./helpers');

describe('Admin course & student management', () => {
  let app;
  let adminToken;

  beforeAll(async () => {
    app = await buildApp();
    adminToken = (await loginAs(app, 'admin', 'admin123')).token;
  });

  test('a student cannot access admin routes', async () => {
    await request(app)
      .post('/api/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test', email: 'test@example.com', password: 'abcd1234', year: 'First Year' });

    const login = await loginAs(app, 'test@example.com', 'abcd1234');
    const res = await request(app)
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${login.token}`)
      .send({ title: 'Should Fail', year: 'First Year' });

    expect(res.status).toBe(403);
  });

  test('admin can create a course with valid data', async () => {
    const res = await request(app)
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Calculus I', description: 'Limits and derivatives', year: 'First Year' });

    expect(res.status).toBe(201);
    expect(res.body.course.title).toBe('Calculus I');
    expect(res.body.course.lectures).toEqual([]);
  });

  test('rejects a course with an invalid year', async () => {
    const res = await request(app)
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Bad Year Course', year: 'Fifth Year' });

    expect(res.status).toBe(400);
  });

  test('rejects a course with a missing title', async () => {
    const res = await request(app)
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 'First Year' });

    expect(res.status).toBe(400);
  });

  test('public course listing only exposes safe fields (no lecture internals)', async () => {
    const res = await request(app).get('/api/courses').query({ year: 'First Year' });
    expect(res.status).toBe(200);
    expect(res.body.courses.length).toBeGreaterThan(0);
    const course = res.body.courses[0];
    expect(course).toEqual(
      expect.objectContaining({ id: expect.any(String), title: expect.any(String), lectureCount: expect.any(Number) })
    );
    expect(course.lectures).toBeUndefined();
  });

  test('duplicate student email is rejected', async () => {
    await request(app)
      .post('/api/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dup', email: 'dup@example.com', password: 'abcd1234', year: 'First Year' });

    const res = await request(app)
      .post('/api/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dup Two', email: 'dup@example.com', password: 'abcd1234', year: 'First Year' });

    expect(res.status).toBe(409);
  });

  test('admin can update a student email, username, year, and password', async () => {
    const created = await request(app)
      .post('/api/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Edit Student', email: 'edit-old@example.com', password: 'oldpass', year: 'First Year' });

    const res = await request(app)
      .put(`/api/admin/students/${created.body.student.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'edit-new@example.com',
        username: 'edit-student',
        password: 'newpass',
        year: 'Second Year',
      });

    expect(res.status).toBe(200);
    expect(res.body.student).toEqual(expect.objectContaining({
      email: 'edit-new@example.com',
      username: 'edit-student',
      year: 'Second Year',
    }));

    const login = await loginAs(app, 'edit-student', 'newpass');
    expect(login.user.role).toBe('student');
  });

  test('admin student list never contains password hashes', async () => {
    const res = await request(app).get('/api/admin/students').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const student of res.body.students) {
      expect(student.passwordHash).toBeUndefined();
      expect(student.password).toBeUndefined();
    }
  });

  test('admin accounts are excluded from the student list', async () => {
    await global.__TEST_PG_POOL__.query(
      `INSERT INTO students (id, name, email, username, password_hash, year, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['legacy-admin-student', 'System Admin', 'admin@example.com', 'admin@example.com', 'not-used', 'First Year', Date.now()]
    );

    const res = await request(app).get('/api/admin/students').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.students.some((student) => student.id === 'legacy-admin-student')).toBe(false);
  });
});

'use strict';

const request = require('supertest');
const { buildApp, loginAs } = require('./helpers');

describe('Authentication', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp();
  });

  test('logs in the seeded admin with correct credentials', async () => {
    const body = await loginAs(app, 'admin', 'admin123');
    expect(body.ok).toBe(true);
    expect(body.token).toEqual(expect.any(String));
    expect(body.user.role).toBe('admin');
  });

  test('rejects an invalid admin password', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  test('rejects a login request missing fields', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: 'admin' });
    expect(res.status).toBe(400);
  });

  test('rejects protected routes without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('rejects protected routes with a garbage token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('/api/auth/me returns the current admin profile', async () => {
    const { token } = await loginAs(app, 'admin', 'admin123');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });
});

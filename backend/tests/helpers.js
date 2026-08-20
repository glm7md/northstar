'use strict';

const createApp = require('../src/app');
const adminsRepo = require('../src/repositories/admins.repository');
const request = require('supertest');

async function buildApp() {
  await adminsRepo.ensureSeedAdmin();
  return createApp();
}

async function loginAs(app, identifier, password) {
  const res = await request(app).post('/api/auth/login').send({ identifier, password });
  return res.body;
}

module.exports = { buildApp, loginAs };

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { newDb } = require('pg-mem');

const tmpUploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'northstar-test-uploads-'));

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';
process.env.DATABASE_URL = 'postgres://unused-in-tests';
process.env.UPLOADS_DIR = tmpUploadsDir;
process.env.CORS_ORIGIN = 'http://localhost:5500';
process.env.LOG_LEVEL = 'silent';

const mem = newDb({ autoCreateForeignKeyIndices: true });
const { Pool } = mem.adapters.createPg();
global.__TEST_PG_POOL__ = new Pool();

const migrationsDir = path.resolve(__dirname, '..', 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

beforeAll(async () => {
  for (const file of migrationFiles) {
    let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    sql = sql.replace(/\s+USING\s+[^;]+(?=;)/gi, '');
    await global.__TEST_PG_POOL__.query(sql);
  }
});

afterAll(() => {
  fs.rmSync(tmpUploadsDir, { recursive: true, force: true });
});

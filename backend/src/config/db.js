'use strict';

const env = require('./env');

let pool = null;

function getPool() {
  if (pool) return pool;

  if (env.NODE_ENV === 'test' && global.__TEST_PG_POOL__) {
    pool = global.__TEST_PG_POOL__;
    return pool;
  }

  const { Pool } = require('pg');
  pool = new Pool({ connectionString: env.DATABASE_URL });
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

function placeholders(count, start = 1) {
  return Array.from({ length: count }, (_, i) => `$${start + i}`).join(', ');
}

async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getPool, query, withTransaction, placeholders };

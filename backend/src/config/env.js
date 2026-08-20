'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    console.warn(`[config] Warning: ${name} is not set. Using an insecure development default.`);
  }
  return value;
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 3000),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5500',

  DATABASE_URL: required('DATABASE_URL', process.env.NODE_ENV === 'test' ? 'postgres://unused-in-tests' : undefined),

  JWT_SECRET: required('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '12h',

  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',

  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || 'northstar',

  LOG_LEVEL: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),

  UPLOADS_DIR: process.env.UPLOADS_DIR || path.resolve(__dirname, '..', '..', 'uploads'),
  PUBLIC_UPLOADS_BASE_URL: process.env.PUBLIC_UPLOADS_BASE_URL || `http://localhost:${process.env.PORT || 3000}/uploads`,
};

module.exports = env;

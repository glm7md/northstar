'use strict';

const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const env = require('../config/env');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

let supabaseClient = null;
if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  logger.info('[storage] Using Supabase Storage backend');
} else {
  logger.warn('[storage] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — falling back to local disk storage (dev/test only, not durable across deploys)');
}

function safeFileName(originalName) {
  const ext = path.extname(String(originalName || '')).replace(/[^a-zA-Z0-9.]/g, '');
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
}

/**
 * @param {Buffer} buffer
 * @param {{ originalName: string, contentType: string, subPath: string }} meta
 * @returns {Promise<{ filePath: string, publicUrl: string }>}
 */
async function uploadFile(buffer, { originalName, contentType, subPath }) {
  const cleanSubPath = String(subPath || 'uploads').replace(/^\/+|\/+$/g, '');
  const fileName = safeFileName(originalName);
  const filePath = `${cleanSubPath}/${fileName}`;

  if (supabaseClient) {
    const { error } = await supabaseClient.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .upload(filePath, buffer, {
        contentType: contentType || 'application/octet-stream',
        upsert: true,
      });

    if (error) {
      logger.error({ err: error }, 'Supabase upload failed');
      throw AppError.badRequest(`Upload failed: ${error.message}`);
    }

    const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
    const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/${encodedPath}`;
    return { filePath, publicUrl };
  }

  // Local disk fallback
  const absoluteDir = path.join(env.UPLOADS_DIR, cleanSubPath);
  await fs.mkdir(absoluteDir, { recursive: true });
  await fs.writeFile(path.join(absoluteDir, fileName), buffer);
  const publicUrl = `${env.PUBLIC_UPLOADS_BASE_URL}/${filePath}`;
  return { filePath, publicUrl };
}

module.exports = { uploadFile };
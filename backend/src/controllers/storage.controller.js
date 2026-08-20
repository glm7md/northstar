'use strict';

const asyncHandler = require('../utils/asyncHandler');
const storageService = require('../storage/storage.service');
const AppError = require('../utils/AppError');

const ADMIN_PATHS = {
  covers: ['image/'],
  pdfs: ['application/pdf'],
  'quiz-images': ['image/'],
};
const STUDENT_PATHS = {
  'quiz-answers': ['image/'],
};

function isAllowedContentType(allowedPrefixes, contentType) {
  return allowedPrefixes.some((prefix) => (contentType || '').startsWith(prefix));
}

const upload = asyncHandler(async (req, res) => {
  const file = req.uploadedFile;
  const subPath = (req.uploadedFields && req.uploadedFields.path) || 'uploads';

  if (!file || !file.filename || !file.data || file.data.length === 0) {
    throw AppError.badRequest('Missing file upload data.');
  }

  const role = req.user.role;
  const allowList = role === 'admin' ? { ...ADMIN_PATHS, ...STUDENT_PATHS } : STUDENT_PATHS;
  const allowedPrefixes = allowList[subPath];

  if (!allowedPrefixes) {
    throw AppError.forbidden(`You are not allowed to upload to "${subPath}".`);
  }
  if (!isAllowedContentType(allowedPrefixes, file.contentType)) {
    throw AppError.badRequest(`Unsupported file type for "${subPath}": ${file.contentType || 'unknown'}.`);
  }

  const { publicUrl, filePath } = await storageService.uploadFile(file.data, {
    originalName: file.filename,
    contentType: file.contentType,
    subPath,
  });

  res.json({ ok: true, filePath, publicUrl });
});

module.exports = { upload };
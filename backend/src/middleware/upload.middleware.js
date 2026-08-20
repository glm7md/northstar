'use strict';

const Busboy = require('busboy');
const AppError = require('../utils/AppError');

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

function parseMultipart(req, res, next) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.startsWith('multipart/form-data')) {
    return next(AppError.badRequest('Expected multipart/form-data content type.'));
  }

  let busboy;
  try {
    busboy = Busboy({ headers: req.headers, limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
  } catch (err) {
    return next(AppError.badRequest('Invalid upload request.'));
  }

  const fields = {};
  let fileInfo = null;
  let fileTooLarge = false;
  let responded = false;

  const fail = (err) => {
    if (responded) return;
    responded = true;
    req.unpipe(busboy);
    next(err);
  };

  busboy.on('field', (name, value) => {
    fields[name] = value;
  });

  busboy.on('file', (fieldname, file, info) => {
    const chunks = [];
    file.on('data', (chunk) => chunks.push(chunk));
    file.on('limit', () => {
      fileTooLarge = true;
      file.resume();
    });
    file.on('end', () => {
      if (fileTooLarge) return;
      fileInfo = {
        fieldname,
        filename: info?.filename,
        contentType: info?.mimeType,
        data: Buffer.concat(chunks),
      };
    });
  });

  busboy.on('error', (err) => fail(AppError.badRequest(`Upload error: ${err.message}`)));

  busboy.on('finish', () => {
    if (responded) return;
    if (fileTooLarge) return fail(AppError.tooLarge());
    responded = true;
    req.uploadedFields = fields;
    req.uploadedFile = fileInfo;
    next();
  });

  req.pipe(busboy);
}

module.exports = { parseMultipart, MAX_UPLOAD_BYTES };

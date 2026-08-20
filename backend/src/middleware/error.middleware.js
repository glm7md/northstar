'use strict';

const env = require('../config/env');
const logger = require('../utils/logger');

function notFoundHandler(req, res) {
  res.status(404).json({ ok: false, error: 'Route not found.' });
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const isOperational = err.isOperational === true;

  if (statusCode >= 500 || !isOperational) {
    (req.log || logger).error({ err }, 'Unhandled error');
  } else {
    (req.log || logger).warn({ err: err.message, statusCode }, 'Request error');
  }

  const payload = {
    ok: false,
    error: isOperational ? err.message : 'Something went wrong on our end.',
  };
  if (err.details) payload.details = err.details;
  if (env.NODE_ENV === 'development' && !isOperational) payload.stack = err.stack;

  res.status(statusCode).json(payload);
}

module.exports = { notFoundHandler, errorHandler };

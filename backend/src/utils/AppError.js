'use strict';

class AppError extends Error {
  constructor(message, statusCode = 500, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) {
    return new AppError(message, 400, details);
  }

  static unauthorized(message = 'Authentication required.') {
    return new AppError(message, 401);
  }

  static forbidden(message = 'You do not have permission to do that.', details) {
    return new AppError(message, 403, details);
  }

  static notFound(message = 'Resource not found.') {
    return new AppError(message, 404);
  }

  static conflict(message) {
    return new AppError(message, 409);
  }

  static tooLarge(message = 'Uploaded file is too large.') {
    return new AppError(message, 413);
  }

  static internal(message = 'Something went wrong on our end.') {
    return new AppError(message, 500);
  }
}

module.exports = AppError;

/**
 * Error Handling Middleware
 * Centralized error handling for Express routes
 */

const logger = require('../utils/logger');

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
}

/**
 * Global error handler
 */
function errorHandler(err, req, res, next) {
  logger.error('Express error', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl
  });

  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
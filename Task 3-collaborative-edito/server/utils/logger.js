/**
 * Logger Utility
 * Provides consistent logging across the application
 */

const LOG_LEVELS = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG'
  };
  
  class Logger {
    constructor() {
      this.logLevel = process.env.LOG_LEVEL || 'INFO';
    }
  
    /**
     * Format timestamp
     */
    getTimestamp() {
      return new Date().toISOString();
    }
  
    /**
     * Format log message
     */
    formatMessage(level, message, data = null) {
      const timestamp = this.getTimestamp();
      const baseMessage = `[${timestamp}] [${level}] ${message}`;
      
      if (data) {
        return `${baseMessage} ${JSON.stringify(data)}`;
      }
      
      return baseMessage;
    }
  
    /**
     * Log error messages
     */
    error(message, error = null) {
      console.error(this.formatMessage(LOG_LEVELS.ERROR, message, error));
    }
  
    /**
     * Log warning messages
     */
    warn(message, data = null) {
      console.warn(this.formatMessage(LOG_LEVELS.WARN, message, data));
    }
  
    /**
     * Log info messages
     */
    info(message, data = null) {
      console.log(this.formatMessage(LOG_LEVELS.INFO, message, data));
    }
  
    /**
     * Log debug messages
     */
    debug(message, data = null) {
      if (this.logLevel === 'DEBUG') {
        console.log(this.formatMessage(LOG_LEVELS.DEBUG, message, data));
      }
    }
  
    /**
     * Log connection events
     */
    connection(socketId, event) {
      this.info(`Socket ${event}`, { socketId });
    }
  
    /**
     * Log room events
     */
    room(roomId, event, data = null) {
      this.info(`Room ${event}`, { roomId, ...data });
    }
  }
  
  module.exports = new Logger();
/**
 * Socket Client Manager
 * Handles WebSocket connection and event management
 */

class SocketClient {
    constructor() {
      this.socket = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 10;
      this.eventHandlers = {};
    }
  
    /**
     * Initialize socket connection
     * @param {string} serverUrl - Server URL
     * @param {Object} options - Socket.IO options
     */
    connect(serverUrl = window.location.origin, options = {}) {
      const defaultOptions = {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
        timeout: 20000
      };
  
      this.socket = io(serverUrl, { ...defaultOptions, ...options });
      this.setupConnectionHandlers();
      
      return this.socket;
    }
  
    /**
     * Setup connection event handlers
     */
    setupConnectionHandlers() {
      this.socket.on('connect', () => {
        console.log('[SocketClient] Connected:', this.socket.id);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.trigger('connect', { socketId: this.socket.id });
      });
  
      this.socket.on('disconnect', (reason) => {
        console.log('[SocketClient] Disconnected:', reason);
        this.isConnected = false;
        this.trigger('disconnect', { reason });
      });
  
      this.socket.on('connect_error', (error) => {
        console.error('[SocketClient] Connection error:', error);
        this.trigger('connect_error', { error });
      });
  
      this.socket.on('reconnect_attempt', (attempt) => {
        console.log('[SocketClient] Reconnection attempt:', attempt);
        this.reconnectAttempts = attempt;
        this.trigger('reconnect_attempt', { attempt });
      });
  
      this.socket.on('reconnect', (attempt) => {
        console.log('[SocketClient] Reconnected after', attempt, 'attempts');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.trigger('reconnect', { attempt });
      });
  
      this.socket.on('reconnect_failed', () => {
        console.error('[SocketClient] Reconnection failed');
        this.trigger('reconnect_failed', {});
      });
    }
  
    /**
     * Register event handler
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
      if (!this.eventHandlers[event]) {
        this.eventHandlers[event] = [];
        
        // Setup socket listener
        this.socket.on(event, (data) => {
          this.trigger(event, data);
        });
      }
      
      this.eventHandlers[event].push(callback);
    }
  
    /**
     * Remove event handler
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
      if (!this.eventHandlers[event]) return;
      
      const index = this.eventHandlers[event].indexOf(callback);
      if (index > -1) {
        this.eventHandlers[event].splice(index, 1);
      }
    }
  
    /**
     * Trigger event handlers
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    trigger(event, data) {
      const handlers = this.eventHandlers[event];
      if (!handlers) return;
      
      handlers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[SocketClient] Error in ${event} handler:`, error);
        }
      });
    }
  
    /**
     * Emit event to server
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    emit(event, data) {
      if (!this.socket) {
        console.error('[SocketClient] Socket not initialized');
        return;
      }
      
      this.socket.emit(event, data);
      console.log(`[SocketClient] Emitted ${event}:`, data);
    }
  
    /**
     * Disconnect socket
     */
    disconnect() {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
        this.isConnected = false;
      }
    }
  
    /**
     * Get connection status
     * @returns {boolean} Connection status
     */
    getConnectionStatus() {
      return this.isConnected;
    }
  
    /**
     * Get socket ID
     * @returns {string|null} Socket ID
     */
    getSocketId() {
      return this.socket ? this.socket.id : null;
    }
  }
  
  // Export singleton instance
  const socketClient = new SocketClient();
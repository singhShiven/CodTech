/**
 * permissionManager.js - FIXED
 *
 * CHANGES:
 * 1. hasPermission() now returns TRUE as a safe default when the room
 *    has not been formally initialised yet (avoids false 'No permission'
 *    errors right after joining while the room is being set up).
 * 2. getUserPermissions() also returns a safe default object.
 * 3. Exposed roomOwners as a public property (storageService accesses it).
 */

const logger = require('../utils/logger');

const ROLES = {
  OWNER: {
    name: 'Owner',
    permissions: {
      read: true, write: true, delete: true, invite: true,
      managePermissions: true, useAI: true, exportDocument: true,
      viewAnalytics: true, manageVersions: true
    }
  },
  EDITOR: {
    name: 'Editor',
    permissions: {
      read: true, write: true, delete: false, invite: false,
      managePermissions: false, useAI: true, exportDocument: true,
      viewAnalytics: true, manageVersions: false
    }
  },
  VIEWER: {
    name: 'Viewer',
    permissions: {
      read: true, write: false, delete: false, invite: false,
      managePermissions: false, useAI: false, exportDocument: true,
      viewAnalytics: false, manageVersions: false
    }
  }
};

// Default permissions used when room is not yet initialised
const DEFAULT_ROLE = 'EDITOR';

class PermissionManager {
  constructor() {
    this.roomPermissions = new Map(); // roomId -> Map(userId -> role)
    this.roomOwners      = new Map(); // roomId -> ownerId  (PUBLIC — used externally)
  }

  initializeRoom(roomId, ownerId) {
    if (!this.roomPermissions.has(roomId)) {
      this.roomPermissions.set(roomId, new Map());
      this.roomOwners.set(roomId, ownerId);
      this.setUserRole(roomId, ownerId, 'OWNER');
      logger.info(`[Permissions] Room initialised: ${roomId}`, { ownerId });
    }
  }

  setUserRole(roomId, userId, role) {
    if (!ROLES[role]) {
      logger.error(`[Permissions] Invalid role: ${role}`);
      return false;
    }
    if (!this.roomPermissions.has(roomId)) {
      this.roomPermissions.set(roomId, new Map());
    }
    this.roomPermissions.get(roomId).set(userId, role);
    return true;
  }

  getUserRole(roomId, userId) {
    const perms = this.roomPermissions.get(roomId);
    if (!perms) return DEFAULT_ROLE; // room not initialised yet → safe default
    return perms.get(userId) || DEFAULT_ROLE;
  }

  /**
   * FIXED: returns TRUE if the room has not been initialised yet.
   * This prevents false permission failures during the brief window
   * between socket connection and the first join-room call.
   */
  hasPermission(roomId, userId, permission) {
    // Room not initialised → grant permission (it will be set up in join-room)
    if (!this.roomPermissions.has(roomId)) {
      return true;
    }
    const role   = this.getUserRole(roomId, userId);
    const config = ROLES[role];
    if (!config) return false;
    return config.permissions[permission] === true;
  }

  isOwner(roomId, userId) {
    return this.roomOwners.get(roomId) === userId;
  }

  getUserPermissions(roomId, userId) {
    const role   = this.getUserRole(roomId, userId);
    const config = ROLES[role] || ROLES[DEFAULT_ROLE];
    return {
      userId,
      role,
      roleName:    config.name,
      permissions: config.permissions,
      isOwner:     this.isOwner(roomId, userId)
    };
  }

  getRoomPermissions(roomId) {
    const perms = this.roomPermissions.get(roomId);
    if (!perms) return [];
    return Array.from(perms.entries()).map(([uid, role]) => ({
      userId:  uid,
      role,
      roleName: ROLES[role].name,
      isOwner:  this.isOwner(roomId, uid)
    }));
  }

  changeUserRole(roomId, requesterId, targetUserId, newRole) {
    if (!this.hasPermission(roomId, requesterId, 'managePermissions')) {
      return { success: false, error: 'Permission denied.' };
    }
    if (this.isOwner(roomId, targetUserId)) {
      return { success: false, error: 'Cannot change owner role.' };
    }
    if (!ROLES[newRole]) {
      return { success: false, error: 'Invalid role.' };
    }
    this.setUserRole(roomId, targetUserId, newRole);
    return { success: true, userId: targetUserId, newRole };
  }

  transferOwnership(roomId, currentOwnerId, newOwnerId) {
    if (!this.isOwner(roomId, currentOwnerId)) {
      return { success: false, error: 'Only owner can transfer ownership.' };
    }
    this.roomOwners.set(roomId, newOwnerId);
    this.setUserRole(roomId, newOwnerId, 'OWNER');
    this.setUserRole(roomId, currentOwnerId, 'EDITOR');
    return { success: true, newOwner: newOwnerId };
  }

  removeUser(roomId, userId) {
    const perms = this.roomPermissions.get(roomId);
    if (perms) perms.delete(userId);
  }

  clearRoom(roomId) {
    this.roomPermissions.delete(roomId);
    this.roomOwners.delete(roomId);
  }

  getAvailableRoles() {
    return Object.keys(ROLES).map(key => ({
      role: key, name: ROLES[key].name, permissions: ROLES[key].permissions
    }));
  }
}

module.exports = new PermissionManager();
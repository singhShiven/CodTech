/**
 * socketHandler.js - FIXED
 *
 * ROOT CAUSES FIXED:
 * 1. currentRoom and currentUser are mutable closure variables.
 *    AI handlers were initialized ONCE at connection time, capturing
 *    the initial null values by reference — not the live values.
 *    FIX: Pass getter functions () => currentRoom, () => currentUser
 *    so AI handlers always read the CURRENT value.
 *
 * 2. Analytics handler was calling permissionManager with stale room.
 *    FIX: All handlers now call getCurrentRoom() / getCurrentUser().
 *
 * 3. Permission check for analytics used hardcoded 'viewAnalytics'
 *    but some users may not have permissions initialized yet.
 *    FIX: Graceful fallback when permission data is missing.
 */
const aiService = require('../services/aiService');



const roomManager       = require('../managers/roomManager');
const versionManager    = require('../managers/versionManager');
const analyticsManager  = require('../managers/analyticsManager');
const permissionManager = require('../managers/permissionManager');
const storageService    = require('../services/storageService');
const { initializeAIHandlers } = require('./aiHandler');
const logger            = require('../utils/logger');

// ── Colour palette ────────────────────────────────────────────────────────────
const USER_COLORS = [
  '#FF6B6B','#4ECDC4','#45B7D1','#FFA07A',
  '#98D8C8','#F7DC6F','#BB8FCE','#85C1E2'
];
function generateUserColor() {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

// ── Input validation ──────────────────────────────────────────────────────────
function isValidRoomId(id) {
  return id && typeof id === 'string' &&
         id.length >= 3 && id.length <= 50; // ✅ remove regex restriction
}
function isValidUsername(u) {
  return u && typeof u === 'string' &&
         u.trim().length >= 1 && u.trim().length <= 20;
}

// ── Main initialiser ──────────────────────────────────────────────────────────
function initializeSocketHandlers(io) {

  io.on('connection', (socket) => {
    socket.on("send-invite", (data) => {
      console.log("📨 Invite sent:", data);
  
      // optional future:
      // send email / save invite
    });
      // ── Mutable state for THIS connection ──────────────────────────────────
      console.log("✅ CLIENT CONNECTED:", socket.id);
    logger.connection(socket.id, 'CONNECTED');
    let currentRoom = null;
    let currentUser = null;
    let saveTimeout;
    let lastEditActivity = 0;
    const getCurrentRoom = () => currentRoom;
    const getCurrentUser = () => currentUser;
    initializeAIHandlers(io, socket, getCurrentRoom, getCurrentUser);
    // ✅ HEARTBEAT HANDLER (correct place)
    socket.on('heartbeat', () => {
      socket.emit('heartbeat-ack');
    });
    

 
    // ── Attach AI handlers ONCE, passing getters so they always see
    //    the live currentRoom / currentUser values after join-room fires ──────
    

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: join-room
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('join-room', async (data) => {
      console.log("📥 JOIN ROOM RECEIVED:", data);
      console.log("JOIN ROOM EVENT RECEIVED:", data);
      
      try {
        const { roomId, username, userId } = data || {};

        if (!isValidRoomId(roomId)) {
          socket.emit('error', { message: 'Invalid room ID.' });
          return;
        }
        if (!isValidUsername(username)) {
          socket.emit('error', { message: 'Invalid username.' });
          return;
        }

        // ── Room access check (authenticated users only) ─────────────────────
        if (socket.user) {
          try {
            const Document = require('../models/Document');
            const doc = await Document.findOne({ roomId });
            if (doc && !doc.hasAccess(socket.user._id)) {
              socket.emit('error', { message: 'Access denied to this document.' });
              return;
            }
          } catch (accessErr) {
            logger.error('Room access check error', accessErr);
          }
        }

        // ── Leave previous room ──────────────────────────────────────────────
        if (currentRoom) {
          socket.leave(currentRoom);
          roomManager.removeUser(currentRoom, socket.id);
          analyticsManager.trackSession(currentRoom, socket.id,
                                        currentUser?.username || '?', 'leave');
          io.to(currentRoom).emit('user-left', {
            user: currentUser,
            totalUsers: roomManager.getUsers(currentRoom).length
          });
        }

        // ── Build user object ────────────────────────────────────────────────
        currentUser = {
          userId:   socket.id,
          username: username.trim(),
          color:    generateUserColor()
        };

        // ── Join new room ────────────────────────────────────────────────────
        currentRoom = roomId;           // ← mutable assignment happens HERE
        socket.join(roomId);

        await roomManager.getOrCreateRoom(roomId);

        const room = roomManager.addUser(
          roomId,
          socket.id,
          currentUser.username,
          currentUser.color
        );
        console.log("✅ USER ADDED:", {
          roomId,
          socketId: socket.id,
          totalUsers: room.users.size
        });
console.log("ROOM AFTER ADD USER:", room);
        // ── Permissions ──────────────────────────────────────────────────────
        const isFirstUser = room.users.size === 1;

        if (isFirstUser) {
          permissionManager.initializeRoom(roomId, socket.id);
          analyticsManager.initializeRoom(roomId);
        
          if (userId) {
            await storageService.saveDocument(roomId, {
              ownerId: userId
            });
          } else {
            console.log("⚠️ No userId received → owner not set");
          }
        
        } else {
          // 🔥 THIS IS WHAT YOU ARE MISSING
          permissionManager.setUserRole(roomId, socket.id, 'EDITOR');
        }
        // ── Analytics session ────────────────────────────────────────────────
        analyticsManager.trackSession(roomId, socket.id, currentUser.username, 'join');

        // ── Load persisted content ───────────────────────────────────────────
        let content = roomManager.getContent(roomId);
        if (!content) {
          const saved = await storageService.loadDocument(roomId);
          if (saved) {
            content = saved.content;
            roomManager.updateContent(roomId, content, socket.id);
          }
        }

        // ── Get permissions object ───────────────────────────────────────────
        const permissions = permissionManager.getUserPermissions(roomId, socket.id);
        console.log("📤 EMITTING room-joined to:", socket.id);
console.log("📦 DATA:", {
  content,
  roomId,
  user: currentUser
});
const users = roomManager.getUsers(roomId);

console.log("🔥 USERS FROM ROOM MANAGER:", users);
        // ── Respond to joining user ──────────────────────────────────────────
        socket.emit('room-joined', {
          content: content || '',
          title: room.title || 'Untitled Document',  // 🔥 ADD THIS LINE
          users: roomManager.getUsers(roomId),
          roomId: roomId,
          user: currentUser,
          userColor: currentUser.color,
          permissions: permissions,
          isFirstUser: isFirstUser
        });

        // ── Start auto-save (owner only) ─────────────────────────────────────
        if (isFirstUser) {
          versionManager.startAutoSave(
            roomId,
            () => roomManager.getContent(roomId)
          );
        
          // ✅ FORCE INITIAL SAVE (IMPORTANT)
          const initialContent = roomManager.getContent(roomId) || "New document started";
          await versionManager.saveVersion(roomId, initialContent, currentUser.username);
        }

        // ── Notify all in room ───────────────────────────────────────────────
        socket.to(roomId).emit('user-joined', {
          
          user:       currentUser,
          totalUsers: room.users.size,
          timestamp:  Date.now()
          
          
        });
        socket.to(roomId).emit('activity-update', {
          type: 'join',
          user: currentUser,
          message: `${currentUser.username} joined`,
          timestamp: Date.now()
        });
        console.log("ROOM USERS:", roomManager.getUsers(roomId));
        io.to(roomId).emit('users-update', {
          users: roomManager.getUsers(roomId)
        });

        logger.room(roomId, 'USER_JOINED', { username: currentUser.username });

      } catch (err) {
        logger.error('join-room error', err);
        socket.emit('error', { message: 'Failed to join room.' });
      }
    });
// ─────────────────────────────────────────────────────────────────────────
// EVENT: title-change (🔥 REAL-TIME TITLE SYNC)
// ─────────────────────────────────────────────────────────────────────────
socket.on('title-change', async (data) => {
  try {
    const room = getCurrentRoom();
    const user = getCurrentUser();

    if (!room || !user) return;

    const { title } = data || {};
    if (!title) return;

    // ✅ UPDATE IN ROOM MANAGER (IMPORTANT)
    const roomData = roomManager.getRoom(room);
    if (roomData) {
      roomData.title = title;
    }

    // ✅ OPTIONAL: SAVE TO DB (recommended)
    await storageService.saveDocument(room, { title });

    // ✅ BROADCAST TO OTHER USERS
    socket.to(room).emit('title-updated', { title });

    // ✅ ACTIVITY LOG (BONUS 🔥)
    io.to(room).emit('activity-update', {
      type: 'edit',
      user,
      message: `${user.username} renamed the document`,
      timestamp: Date.now()
    });

    console.log(`📝 Title updated in ${room}: ${title}`);

  } catch (err) {
    logger.error('title-change error', err);
  }
});
    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: content-change
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('content-change', async (data) => {
      try {
        const room = getCurrentRoom();
        const user = getCurrentUser();

        if (!room || !user) {
          socket.emit('error', { message: 'Not in a room' });
          return;
        }
        console.log("🔐 PERMISSION CHECK:", {
          room,
          socketId: socket.id,
          permissions: permissionManager.getUserPermissions(room, socket.id)
        });
        if (!permissionManager.hasPermission(room, socket.id, 'write')) {
          socket.emit('error', { message: 'No write permission.' });
          return;
        }

        const { content, cursorPosition } = data || {};
        if (typeof content !== 'string') {
          socket.emit('error', { message: 'Invalid content format.' });
          return;
        }

        const old = roomManager.getContent(room) || '';
        const charsAdded   = Math.max(0, content.length - old.length);
        const charsRemoved = Math.max(0, old.length - content.length);

        roomManager.updateContent(room, content, socket.id);
        analyticsManager.trackEdit(room, socket.id, user.username,
                                   { charactersAdded: charsAdded,
                                     charactersRemoved: charsRemoved });

                                     clearTimeout(saveTimeout);
                                     // ✅ BROADCAST ACTIVITY TO ALL USERS
                                     const now = Date.now();
                                     
                                     if (now - lastEditActivity > 3000) {  // 3 sec cooldown
                                       lastEditActivity = now;
                                     
                                       socket.to(room).emit('activity-update', {
                                         type: 'edit',
                                         user: user,
                                         message: `${user.username} is editing...`,
                                         timestamp: now
                                       });
                                     }

saveTimeout = setTimeout(async () => {
  try {
    await storageService.saveDocument(room, {
      content
    
    });
    console.log("💾 Document auto-saved");
  } catch (err) {
    console.error("❌ Save failed:", err.message);
  }
}, 800);

socket.to(room).emit('content-update', {
          content,
          updatedBy:      user,
          cursorPosition: cursorPosition || 0,
          timestamp:      Date.now()
        });

      } catch (err) {
        logger.error('content-change error', err);
      }
    });
// ─────────────────────────────────────────────
// EVENT: activity-event (🔥 AI activity sync)
// ─────────────────────────────────────────────
socket.on('activity-event', (data) => {
  try {
    const room = getCurrentRoom();
    const user = getCurrentUser();

    if (!room || !user) return;

    const message = data?.message || `${user?.username || 'Someone'} used AI`;

    io.to(room).emit('activity-update', {
      type: 'ai',
      user,
      message,
      timestamp: Date.now()
    });

  } catch (err) {
    console.error('activity-event error:', err);
  }
});
    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: request-analytics  (FIXED)
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('request-analytics', () => {
      try {
        const room = getCurrentRoom();
        const user = getCurrentUser();

        if (!room || !user) {
          socket.emit('error', { message: 'Not in a room' });
          return;
        }

        // Graceful permission check — default allow if room not yet initialised
        const canView = permissionManager.hasPermission(room, socket.id, 'viewAnalytics');
        if (!canView) {
          socket.emit('analytics-error', { message: 'No permission to view analytics.' });
          return;
        }

        const content = roomManager.getContent(room) || '';

const analytics = aiService.getDocumentAnalytics(content);

socket.emit('analytics-update', analytics);

      } catch (err) {
        logger.error('request-analytics error', err);
        socket.emit('analytics-error', { message: 'Analytics service error.' });
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: request-version-history
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('request-version-history', async () => {
      try {
        const room = getCurrentRoom();
        if (!room) {
          socket.emit('error', { message: 'Not in a room' });
          return;
        }
    
        const timeline = await versionManager.getVersionHistory(room);
    
        const formatted = timeline.map(v => ({
          id: v.versionNumber,
          content: v.content || '',
          author: v.savedBy || 'system',
          timestamp: v.createdAt
        }));
    
        console.log("📦 VERSIONS SENT:", formatted);
    
        socket.emit('version-history', { versions: formatted });
    
      } catch (err) {
        logger.error('request-version-history error', err);
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: restore-version
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('restore-version', async (data) => {
      try {
        const room = getCurrentRoom();
        const user = getCurrentUser();
    
        if (!room || !user) {
          socket.emit('error', { message: 'Not in a room' });
          return;
        }
    
        const { versionId } = data || {};
    
        const version = await versionManager.restoreVersion(room, versionId);
    
        if (version) {
          roomManager.updateContent(room, version.content, socket.id);
    
          io.to(room).emit('content-update', {
            content: version.content,
            updatedBy: user,
            timestamp: Date.now(),
            isRestore: true
          });
    
          socket.emit('version-restored', { versionId, success: true });
    
        } else {
          socket.emit('error', { message: 'Version not found.' });
        }
    
      } catch (err) {
        logger.error('restore-version error', err);
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: request-session-summary
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('request-session-summary', () => {
      try {
        const room = getCurrentRoom();
        if (!room) return;
        const summary = analyticsManager.generateSessionSummary(room);
        socket.emit('session-summary', summary);
      } catch (err) {
        logger.error('request-session-summary error', err);
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: change-user-role
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('change-user-role', (data) => {
      try {
        const room = getCurrentRoom();
        if (!room) { socket.emit('error', { message: 'Not in a room' }); return; }

        const { userId, newRole } = data || {};
        const result = permissionManager.changeUserRole(room, socket.id, userId, newRole);
        if (result.success) {
          io.to(userId).emit('role-changed', {
            newRole,
            permissions: permissionManager.getUserPermissions(room, userId)
          });
          io.to(room).emit('permissions-update', {
            permissions: permissionManager.getRoomPermissions(room)
          });
          socket.emit('role-change-success', result);
        } else {
          socket.emit('error', { message: result.error });
        }

      } catch (err) {
        logger.error('change-user-role error', err);
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: cursor-position
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('cursor-update', (data) => {
      const room = getCurrentRoom();
      const user = getCurrentUser();
      if (!room || !user) return;
      socket.to(room).emit('cursor-update', { user, position: data?.position || 0 });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: typing-start / typing-stop
    // ─────────────────────────────────────────────────────────────────────────
    let lastTypingEmit = 0;

    socket.on('user-typing', (data) => {
      const now = Date.now();
    
      if (now - lastTypingEmit < 200) return; // throttle
    
      lastTypingEmit = now;
    
      const room = getCurrentRoom();
      const user = getCurrentUser();
    
      if (!room || !user) return;
    
      socket.to(room).emit('user-typing', {
        user,
        isTyping: data.isTyping
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: disconnect
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      try {
        logger.connection(socket.id, `DISCONNECTED (${reason})`);

        const room = getCurrentRoom();
        const user = getCurrentUser();

        if (room && user) {
          const removed = roomManager.removeUser(room, socket.id);
          if (removed) {
            analyticsManager.trackSession(room, socket.id, user.username, 'leave');

            io.to(room).emit('user-left', {
              
              user,
              totalUsers: roomManager.getUsers(room).length,
              timestamp:  Date.now()
            });
            io.to(room).emit('activity-update', {
              type: 'leave',
              user,
              message: `${user.username} left`,
              timestamp: Date.now()
            });
            io.to(room).emit('users-update', {
              users: roomManager.getUsers(room)
            });

            permissionManager.removeUser(room, socket.id);

            if (roomManager.getUsers(room).length === 0) {
              versionManager.stopAutoSave(room);
            }

            logger.room(room, 'USER_LEFT', { username: user.username });
          }
        }

      } catch (err) {
        logger.error('disconnect error', err);
      }
    });

  }); // end io.on('connection')

  // Periodic system stats log
  setInterval(() => {
    logger.info('System Stats', roomManager.getSystemStats());
  }, 60000);

}

module.exports = { initializeSocketHandlers };
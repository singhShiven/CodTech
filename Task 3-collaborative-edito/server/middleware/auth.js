const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId).select('-password');
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const authenticateSocket = async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];
  
      // Allow connection even without token (guest mode)
      if (!token) {
        console.log("⚠️ No token → guest connection");
        socket.user = null;
        return next();
      }
  
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.userId).select('-password');
  
      if (!user) {
        console.log("⚠️ User not found → guest connection");
        socket.user = null;
        return next();
      }
  
      socket.user = user;
      next();
  
    } catch (err) {
      console.log("⚠️ Auth error:", err.message);
      socket.user = null;
      next();
    }
  };

module.exports = { authenticate, authenticateSocket };
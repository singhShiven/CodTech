const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

const makeToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

router.post(
  '/register',
  [
    body('username').trim().isLength({ min: 2, max: 30 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
  ],
  async (req, res) => {
    try {
      console.log("📥 REGISTER BODY:", req.body);
  
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log("❌ VALIDATION ERROR:", errors.array());
        return res.status(400).json({ error: errors.array()[0].msg });
      }
  
      const { username, email, password } = req.body;
  
      const exists = await User.findOne({ email });
      if (exists) {
        console.log("⚠️ EMAIL EXISTS");
        return res.status(409).json({ error: 'Email already registered' });
      }
  
      const user = await User.create({ username, email, password });
  
      console.log("✅ USER CREATED:", user);
  
      const token = makeToken(user._id);
  
      res.status(201).json({ token, user: user.toSafeObject() });
  
    } catch (err) {
      console.error("❌ REGISTER ERROR:", err);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const valid = await user.comparePassword(password);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = makeToken(user._id);
      res.json({ token, user: user.toSafeObject() });
    } catch (err) {
      console.error("❌ LOGIN ERROR:", err);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

module.exports = router;
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  try {
    // 1. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeyforlocaldevelopment123!');

    // 2. Check if session exists in DB
    const session = await Session.findOne({ token, userId: decoded.id });
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ message: 'Session expired or invalid, please login again' });
    }

    // 3. Find user and attach to request
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('Authentication Middleware Error:', error.message);
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

module.exports = { protect };

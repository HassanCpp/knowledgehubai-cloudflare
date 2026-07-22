const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkeyforlocaldevelopment123!';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

class AuthService {
  async register({ username, email, password, role }) {
    // 1. Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      throw new Error('User with this email or username already exists');
    }

    // 2. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Create user (Default to 'User' unless specifically 'Admin')
    const finalRole = role === 'Admin' ? 'Admin' : 'User';
    
    // Check if it is the first user overall. If yes, make Admin by default.
    const userCount = await User.countDocuments();
    const assignedRole = userCount === 0 ? 'Admin' : finalRole;

    const user = await User.create({
      username,
      email,
      passwordHash,
      role: assignedRole,
    });

    return {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    };
  }

  async login({ email, password, deviceDetails }) {
    // 1. Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // 2. Compare password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    // 3. Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // 4. Calculate expiration date (default to 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 5. Save session
    await Session.create({
      userId: user._id,
      token,
      deviceDetails,
      expiresAt,
    });

    return {
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
  }

  async logout(token) {
    await Session.deleteOne({ token });
    return { message: 'Logged out successfully' };
  }

  async getAllUsers() {
    return User.find().select('-passwordHash');
  }

  async updateUserRole(userId, newRole) {
    if (!['Admin', 'User'].includes(newRole)) {
      throw new Error('Invalid role specified');
    }
    const user = await User.findByIdAndUpdate(userId, { role: newRole }, { new: true }).select('-passwordHash');
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }
}

module.exports = new AuthService();

const authService = require('../services/auth.service');

class AuthController {
  async register(req, res, next) {
    try {
      const { username, email, password, role } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email, and password are required' });
      }

      const result = await authService.register({ username, email, password, role });
      return res.status(201).json(result);
    } catch (error) {
      res.status(400);
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password, deviceDetails } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const result = await authService.login({ email, password, deviceDetails });
      return res.status(200).json(result);
    } catch (error) {
      res.status(401);
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const result = await authService.logout(req.token);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getMe(req, res, next) {
    try {
      // req.user is set by auth middleware
      return res.status(200).json({
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUsers(req, res, next) {
    try {
      const users = await authService.getAllUsers();
      return res.status(200).json(users);
    } catch (error) {
      next(error);
    }
  }

  async updateUserRole(req, res, next) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ message: 'Role is required' });
      }

      const user = await authService.updateUserRole(userId, role);
      return res.status(200).json(user);
    } catch (error) {
      res.status(400);
      next(error);
    }
  }
}

module.exports = new AuthController();

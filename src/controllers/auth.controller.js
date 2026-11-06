const AuthService = require('../services/auth.service');
const { sendSuccess } = require('../utils/response');

class AuthController {
  static async login(req, res) {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);
    return sendSuccess(res, result, 200);
  }

  static async refresh(req, res) {
    const { refreshToken } = req.body;
    const result = await AuthService.refreshAccessToken(refreshToken);
    return sendSuccess(res, result, 200);
  }

  static async me(req, res) {
    const profile = await AuthService.getProfile(req.user.userId);
    return sendSuccess(res, profile, 200);
  }

  static async logout(req, res) {
    // In stateless JWT, client discards token; if session store is configured, revoke session
    return sendSuccess(res, { message: 'Logged out successfully' }, 200);
  }
}

module.exports = AuthController;

